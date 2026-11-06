import 'server-only';
import { addMinutes } from 'date-fns';
import type { Appointment, AppointmentStatus, Modality, Prisma } from '@prisma/client';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import {
  evaluateCancellation,
  exceedsFutureLimit,
  isOpenStatus,
  OCCUPYING_STATUSES,
  OPEN_STATUSES,
  resolvePriceCents,
} from '@/lib/domain/policies';
import { generateOccurrences } from '@/lib/domain/recurrence';
import { utcToLocalYmd, minutesOfDayLocal, weekdayOfYmd } from '@/lib/domain/time';
import { rateLimit, rateLimitMessage } from '@/lib/ratelimit';
import { getScheduling } from '@/lib/settings';
import { UserError } from './action-result';
import { notifyAdmin, notifyPatient } from './appointment-notifications';
import { assertSlotAvailable, hasHardConflict } from './availability';
import type { SessionUser } from './session';

type Tx = Prisma.TransactionClient;

/* ───────────────────────── Utilitários ───────────────────────── */

export class SlotTakenError extends UserError {
  constructor() {
    super('Este horário acabou de ser ocupado. Escolha outro horário disponível.');
  }
}

/** Detecta a violação da EXCLUDE constraint (23P01) ou falha de serialização. */
function isConflictError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; meta?: { code?: string } };
  return (
    e?.code === 'P2034' ||
    e?.meta?.code === '23P01' ||
    !!e?.message?.includes('Appointment_no_overlap') ||
    !!e?.message?.includes('23P01')
  );
}

async function serializable<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: 'Serializable', timeout: 15_000 });
    } catch (err) {
      if (isConflictError(err)) {
        if ((err as { code?: string }).code === 'P2034' && attempt < 2) continue; // conflito de escrita: tenta de novo
        throw new SlotTakenError();
      }
      throw err;
    }
  }
}

const REASON_MAX = 300;

/** Sincroniza a cobrança com o status da sessão (cancelada/recusada/falta → isenta, etc.). */
async function syncPayment(
  tx: Tx,
  appt: Pick<Appointment, 'id' | 'status' | 'priceCents' | 'packageId'>,
  noShowCharged: boolean,
) {
  if (appt.packageId) return; // coberta pelo pacote
  const payment = await tx.payment.findUnique({ where: { appointmentId: appt.id } });
  if (!payment) return;

  const shouldWaive =
    appt.status === 'CANCELADA_PACIENTE' ||
    appt.status === 'CANCELADA_PSICOLOGA' ||
    appt.status === 'RECUSADA' ||
    (appt.status === 'FALTA' && !noShowCharged);

  if (shouldWaive && payment.status === 'PENDENTE') {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'ISENTO', notes: 'auto: sessão não cobrada' },
    });
  } else if (
    !shouldWaive &&
    payment.status === 'ISENTO' &&
    payment.notes === 'auto: sessão não cobrada' &&
    appt.priceCents > 0
  ) {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'PENDENTE', notes: null },
    });
  }
}

async function patientDefaultPrice(patientId: string, serviceId: string) {
  const [patient, service, scheduling] = await Promise.all([
    db.patientProfile.findUniqueOrThrow({
      where: { id: patientId },
      select: { customPriceCents: true },
    }),
    db.serviceType.findUniqueOrThrow({ where: { id: serviceId } }),
    getScheduling(),
  ]);
  return {
    service,
    price: resolvePriceCents({
      patientCustomCents: patient.customPriceCents,
      serviceCents: service.priceCents,
      defaultCents: scheduling.defaultPriceCents,
    }),
  };
}

/* ───────────────────────── PACIENTE ───────────────────────── */

export interface PatientBookingInput {
  serviceTypeId: string;
  modality: Modality;
  startsAt: Date;
}

export async function bookAsPatient(
  user: SessionUser & { patientProfile: NonNullable<SessionUser['patientProfile']> },
  input: PatientBookingInput,
) {
  if (!user.emailVerifiedAt) {
    throw new UserError(
      'Confirme seu e-mail antes de agendar. Enviamos um link para a sua caixa de entrada.',
    );
  }
  const patient = user.patientProfile;
  if (patient.status !== 'ATIVO') {
    throw new UserError(
      'Seu cadastro não está ativo para novos agendamentos. Entre em contato com o consultório.',
    );
  }
  const rl = await rateLimit(`book:${user.id}`, 10, 60 * 60);
  if (!rl.allowed) throw new UserError(rateLimitMessage(rl));

  const service = await db.serviceType.findFirst({
    where: { id: input.serviceTypeId, active: true, deletedAt: null },
  });
  if (!service) throw new UserError('Serviço indisponível.');
  if (input.modality === 'ONLINE' && !service.allowsOnline)
    throw new UserError('Este serviço não é oferecido online.');
  if (input.modality === 'PRESENCIAL' && !service.allowsInPerson)
    throw new UserError('Este serviço não é oferecido presencialmente.');

  const scheduling = await getScheduling();
  const { price } = await patientDefaultPrice(patient.id, service.id);
  const status: AppointmentStatus = scheduling.manualApproval ? 'PENDENTE' : 'AGENDADA';

  const appt = await serializable(async (tx) => {
    const now = new Date();
    const openFuture = await tx.appointment.count({
      where: {
        patientId: patient.id,
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        startsAt: { gt: now },
      },
    });
    if (exceedsFutureLimit(openFuture, scheduling.maxFutureAppointments)) {
      throw new UserError(
        `Você já possui ${openFuture} sessões futuras em aberto (limite: ${scheduling.maxFutureAppointments}). Remarque ou cancele uma delas para agendar outra.`,
      );
    }

    // O servidor revalida o horário – nunca confia no que o cliente diz estar livre.
    const free = await assertSlotAvailable(input.startsAt, {
      durationMinutes: service.durationMinutes,
      modality: input.modality,
      now,
      client: tx,
    });
    if (!free) throw new SlotTakenError();

    const created = await tx.appointment.create({
      data: {
        patientId: patient.id,
        serviceTypeId: service.id,
        startsAt: input.startsAt,
        endsAt: addMinutes(input.startsAt, service.durationMinutes),
        modality: input.modality,
        status,
        priceCents: price,
        meetingUrl: input.modality === 'ONLINE' ? scheduling.defaultMeetingUrl || null : null,
        createdByRole: 'PACIENTE',
        createdById: user.id,
        confirmedAt: status === 'AGENDADA' ? now : null,
      },
    });
    await tx.payment.create({
      data: {
        patientId: patient.id,
        appointmentId: created.id,
        amountCents: price,
        status: price > 0 ? 'PENDENTE' : 'ISENTO',
        dueDate: new Date(`${utcToLocalYmd(input.startsAt)}T00:00:00Z`),
      },
    });
    return created;
  });

  await audit({
    action: 'APPOINTMENT_CREATE',
    actorId: user.id,
    actorRole: user.role,
    entity: 'Appointment',
    entityId: appt.id,
    metadata: { status },
  });
  await notifyPatient(status === 'PENDENTE' ? 'requested' : 'confirmed', appt.id);
  await notifyAdmin(appt.id, 'Novo agendamento recebido.');
  return appt;
}

async function ownedAppointment(user: SessionUser, id: string) {
  const patientId = user.patientProfile?.id;
  if (!patientId) throw new UserError('Ficha de paciente não encontrada.');
  // FILTRO POR DONO: um paciente nunca alcança a sessão de outro, mesmo trocando o ID.
  const appt = await db.appointment.findFirst({ where: { id, patientId, deletedAt: null } });
  if (!appt) throw new UserError('Sessão não encontrada.');
  return appt;
}

export async function cancelAsPatient(user: SessionUser, appointmentId: string, reason?: string) {
  const appt = await ownedAppointment(user, appointmentId);
  if (!isOpenStatus(appt.status)) throw new UserError('Esta sessão não pode mais ser cancelada.');
  const scheduling = await getScheduling();
  const decision = evaluateCancellation(appt.startsAt, new Date(), scheduling.minCancelHours);
  if (!decision.allowed) {
    throw new UserError(
      `O prazo para cancelar pelo sistema é de ${scheduling.minCancelHours}h de antecedência. Entre em contato diretamente com o consultório.`,
    );
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: 'CANCELADA_PACIENTE',
        cancelledAt: new Date(),
        cancelReason: reason?.slice(0, REASON_MAX),
      },
    });
    await syncPayment(tx, updated, scheduling.noShowCharged);
  });
  await audit({
    action: 'APPOINTMENT_CANCEL',
    actorId: user.id,
    actorRole: user.role,
    entity: 'Appointment',
    entityId: appt.id,
  });
  await notifyPatient('cancelled', appt.id, { reason: 'Cancelamento realizado por você.' });
  await notifyAdmin(appt.id, 'Sessão cancelada pelo paciente.');
}

export async function rescheduleAsPatient(
  user: SessionUser,
  appointmentId: string,
  newStartsAt: Date,
) {
  const appt = await ownedAppointment(user, appointmentId);
  if (!isOpenStatus(appt.status)) throw new UserError('Esta sessão não pode mais ser remarcada.');
  const scheduling = await getScheduling();
  const decision = evaluateCancellation(appt.startsAt, new Date(), scheduling.minCancelHours);
  if (!decision.allowed) {
    throw new UserError(
      `O prazo para remarcar pelo sistema é de ${scheduling.minCancelHours}h de antecedência. Entre em contato diretamente com o consultório.`,
    );
  }
  const durationMinutes = Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000);
  const status: AppointmentStatus = scheduling.manualApproval ? 'PENDENTE' : 'AGENDADA';

  const updated = await serializable(async (tx) => {
    const free = await assertSlotAvailable(newStartsAt, {
      durationMinutes,
      modality: appt.modality,
      excludeAppointmentId: appt.id,
      client: tx,
    });
    if (!free) throw new SlotTakenError();
    return tx.appointment.update({
      where: { id: appt.id },
      data: {
        startsAt: newStartsAt,
        endsAt: addMinutes(newStartsAt, durationMinutes),
        status,
        confirmedAt: status === 'AGENDADA' ? new Date() : null,
        reminder24SentAt: null,
        reminder2SentAt: null,
      },
    });
  });
  await audit({
    action: 'APPOINTMENT_RESCHEDULE',
    actorId: user.id,
    actorRole: user.role,
    entity: 'Appointment',
    entityId: appt.id,
  });
  await notifyPatient(status === 'PENDENTE' ? 'requested' : 'rescheduled', updated.id);
  await notifyAdmin(updated.id, 'Sessão remarcada pelo paciente.');
}

/* ───────────────────────── EQUIPE (ADMIN / SECRETARIA) ───────────────────────── */

export interface StaffCreateInput {
  patientId: string;
  serviceTypeId: string;
  startsAt: Date;
  modality: Modality;
  meetingUrl?: string;
  status?: Extract<AppointmentStatus, 'AGENDADA' | 'CONFIRMADA'>;
  priceCents?: number;
  packageId?: string;
  adminNote?: string;
  notifyPatient?: boolean;
  recurrence?: { frequency: 'SEMANAL' | 'QUINZENAL'; untilYmd?: string; count?: number };
}

export interface StaffCreateResult {
  created: string[];
  skipped: string[]; // datas (YYYY-MM-DD) que conflitaram numa série
}

export async function createAsStaff(
  actor: SessionUser,
  input: StaffCreateInput,
): Promise<StaffCreateResult> {
  const patient = await db.patientProfile.findFirst({
    where: { id: input.patientId, deletedAt: null },
  });
  if (!patient) throw new UserError('Paciente não encontrado.');
  const { service, price: defaultPrice } = await patientDefaultPrice(
    patient.id,
    input.serviceTypeId,
  );
  const scheduling = await getScheduling();
  const price = input.priceCents ?? defaultPrice;
  const status = input.status ?? 'AGENDADA';
  const meetingUrl =
    input.modality === 'ONLINE' ? input.meetingUrl || scheduling.defaultMeetingUrl || null : null;

  // Lista de horários: um só, ou a série gerada.
  let starts: Date[] = [input.startsAt];
  let recurrenceId: string | undefined;
  const skipped: string[] = [];

  const result = await serializable(async (tx) => {
    if (input.packageId) {
      const pkg = await tx.sessionPackage.findFirst({
        where: { id: input.packageId, patientId: patient.id, cancelledAt: null },
      });
      if (!pkg) throw new UserError('Pacote não encontrado para este paciente.');
      if (pkg.expiresAt && pkg.expiresAt < new Date())
        throw new UserError('Este pacote está vencido.');
    }

    if (input.recurrence) {
      const startYmd = utcToLocalYmd(input.startsAt);
      const rule = await tx.recurrenceRule.create({
        data: {
          patientId: patient.id,
          serviceTypeId: service.id,
          frequency: input.recurrence.frequency,
          weekday: weekdayOfYmd(startYmd),
          startMinute: minutesOfDayLocal(input.startsAt),
          durationMinutes: service.durationMinutes,
          modality: input.modality,
          meetingUrl,
          startDate: new Date(`${startYmd}T00:00:00Z`),
          until: input.recurrence.untilYmd
            ? new Date(`${input.recurrence.untilYmd}T00:00:00Z`)
            : null,
        },
      });
      recurrenceId = rule.id;
      starts = generateOccurrences({
        frequency: input.recurrence.frequency,
        startYmd,
        weekday: rule.weekday,
        startMinute: rule.startMinute,
        durationMinutes: service.durationMinutes,
        untilYmd: input.recurrence.untilYmd,
        count: input.recurrence.count ?? (input.recurrence.untilYmd ? undefined : 8),
      }).map((o) => o.startsAt);
    }

    const created: string[] = [];
    for (const startsAt of starts) {
      const endsAt = addMinutes(startsAt, service.durationMinutes);
      if (await hasHardConflict(tx, startsAt, endsAt)) {
        if (!input.recurrence) throw new SlotTakenError();
        skipped.push(utcToLocalYmd(startsAt));
        continue;
      }
      const appt = await tx.appointment.create({
        data: {
          patientId: patient.id,
          serviceTypeId: service.id,
          startsAt,
          endsAt,
          modality: input.modality,
          status,
          priceCents: price,
          meetingUrl,
          recurrenceId,
          packageId: input.packageId,
          adminNote: input.adminNote,
          createdByRole: actor.role,
          createdById: actor.id,
          confirmedAt: new Date(),
        },
      });
      if (!input.packageId) {
        await tx.payment.create({
          data: {
            patientId: patient.id,
            appointmentId: appt.id,
            amountCents: price,
            status: price > 0 ? 'PENDENTE' : 'ISENTO',
            dueDate: new Date(`${utcToLocalYmd(startsAt)}T00:00:00Z`),
          },
        });
      }
      created.push(appt.id);
    }
    if (created.length === 0)
      throw new UserError('Todos os horários da série conflitam com sessões existentes.');
    return created;
  });

  await audit({
    action: 'APPOINTMENT_CREATE',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Appointment',
    entityId: result[0],
    metadata: { count: result.length, skipped: skipped.length },
  });
  if (input.notifyPatient !== false) await notifyPatient('confirmed', result[0]!);
  return { created: result, skipped };
}

type Scope = 'THIS' | 'FOLLOWING';

async function seriesTargets(appt: Appointment, scope: Scope, tx: Tx) {
  if (scope === 'FOLLOWING' && appt.recurrenceId) {
    return tx.appointment.findMany({
      where: {
        recurrenceId: appt.recurrenceId,
        deletedAt: null,
        startsAt: { gte: appt.startsAt },
        status: { in: [...OPEN_STATUSES] },
      },
      orderBy: { startsAt: 'asc' },
    });
  }
  return [appt];
}

/** Arrastar-e-soltar / remarcação pela equipe. Notifica o paciente. */
export async function moveAsStaff(
  actor: SessionUser,
  id: string,
  newStartsAt: Date,
  scope: Scope = 'THIS',
  notify = true,
) {
  const appt = await db.appointment.findFirst({ where: { id, deletedAt: null } });
  if (!appt) throw new UserError('Sessão não encontrada.');
  const deltaMs = newStartsAt.getTime() - appt.startsAt.getTime();

  const moved = await serializable(async (tx) => {
    const targets = await seriesTargets(appt, scope, tx);
    // Para evitar falso conflito entre as próprias sessões da série, libera primeiro os horários.
    const out: Appointment[] = [];
    for (const t of targets) {
      const startsAt = new Date(t.startsAt.getTime() + deltaMs);
      const endsAt = new Date(t.endsAt.getTime() + deltaMs);
      if (await hasHardConflict(tx, startsAt, endsAt, t.id)) throw new SlotTakenError();
      out.push(
        await tx.appointment.update({
          where: { id: t.id },
          data: { startsAt, endsAt, reminder24SentAt: null, reminder2SentAt: null },
        }),
      );
    }
    return out;
  });

  await audit({
    action: 'APPOINTMENT_RESCHEDULE',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Appointment',
    entityId: id,
    metadata: { count: moved.length },
  });
  if (notify) await notifyPatient('rescheduled', id);
}

export async function updateDetailsAsStaff(
  actor: SessionUser,
  id: string,
  data: { meetingUrl?: string | null; adminNote?: string | null; modality?: Modality },
  scope: Scope = 'THIS',
) {
  const appt = await db.appointment.findFirst({ where: { id, deletedAt: null } });
  if (!appt) throw new UserError('Sessão não encontrada.');
  await db.$transaction(async (tx) => {
    const targets = await seriesTargets(appt, scope, tx);
    for (const t of targets) {
      await tx.appointment.update({
        where: { id: t.id },
        data: {
          meetingUrl: data.meetingUrl,
          modality: data.modality,
          // A nota administrativa é individual (não se propaga para a série)
          ...(t.id === appt.id ? { adminNote: data.adminNote } : {}),
        },
      });
    }
  });
  await audit({
    action: 'APPOINTMENT_UPDATE',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Appointment',
    entityId: id,
  });
}

export async function setStatusAsStaff(
  actor: SessionUser,
  id: string,
  status: AppointmentStatus,
  opts: { reason?: string; scope?: Scope; notify?: boolean } = {},
) {
  const appt = await db.appointment.findFirst({ where: { id, deletedAt: null } });
  if (!appt) throw new UserError('Sessão não encontrada.');
  const scheduling = await getScheduling();
  const cancelling =
    status === 'CANCELADA_PSICOLOGA' || status === 'CANCELADA_PACIENTE' || status === 'RECUSADA';

  // Reabrir uma sessão cancelada exige que o horário ainda esteja livre.
  const reopening = !cancelling && !(OCCUPYING_STATUSES as readonly string[]).includes(appt.status);

  await serializable(async (tx) => {
    const targets = await seriesTargets(appt, cancelling ? (opts.scope ?? 'THIS') : 'THIS', tx);
    for (const t of targets) {
      if (reopening && (await hasHardConflict(tx, t.startsAt, t.endsAt, t.id)))
        throw new SlotTakenError();
      const updated = await tx.appointment.update({
        where: { id: t.id },
        data: {
          status,
          confirmedAt:
            status === 'CONFIRMADA' || status === 'AGENDADA' ? new Date() : t.confirmedAt,
          cancelledAt: cancelling ? new Date() : null,
          cancelReason: cancelling ? opts.reason?.slice(0, REASON_MAX) : null,
        },
      });
      await syncPayment(tx, updated, scheduling.noShowCharged);
    }
  });

  await audit({
    action: 'APPOINTMENT_STATUS',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Appointment',
    entityId: id,
    metadata: { status },
  });
  if (opts.notify !== false) {
    if (status === 'CONFIRMADA' && appt.status === 'PENDENTE') await notifyPatient('confirmed', id);
    else if (status === 'RECUSADA') await notifyPatient('refused', id, { reason: opts.reason });
    else if (status === 'CANCELADA_PSICOLOGA')
      await notifyPatient('cancelled', id, {
        reason: opts.reason ?? 'A sessão precisou ser cancelada pela psicóloga.',
      });
  }
}

/** Exclusão lógica (erro de digitação etc.). Não vale para sessões já realizadas com prontuário. */
export async function deleteAsStaff(actor: SessionUser, id: string) {
  const appt = await db.appointment.findFirst({
    where: { id, deletedAt: null },
    include: { clinicalRecord: { select: { id: true } }, payment: true },
  });
  if (!appt) throw new UserError('Sessão não encontrada.');
  if (appt.clinicalRecord)
    throw new UserError(
      'Esta sessão possui registro de prontuário e não pode ser excluída. Use "cancelar".',
    );
  if (appt.payment?.status === 'PAGO')
    throw new UserError('Esta sessão possui pagamento registrado. Cancele-a em vez de excluir.');
  await db.$transaction([
    db.appointment.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELADA_PSICOLOGA' },
    }),
    ...(appt.payment
      ? [
          db.payment.update({
            where: { id: appt.payment.id },
            data: { status: 'ISENTO', notes: 'auto: sessão excluída' },
          }),
        ]
      : []),
  ]);
  await audit({
    action: 'APPOINTMENT_CANCEL',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'Appointment',
    entityId: id,
    metadata: { deleted: true },
  });
}
