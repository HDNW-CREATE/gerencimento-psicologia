'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { addDaysYmd } from '@/lib/domain/time';
import { rateLimitByIp, rateLimitMessage } from '@/lib/ratelimit';
import { optionalTrimmed, ymdSchema } from '@/lib/validators';
import { fail, ok, run, UserError, type ActionResult } from '../action-result';
import {
  bookAsPatient,
  cancelAsPatient,
  createAsStaff,
  deleteAsStaff,
  moveAsStaff,
  rescheduleAsPatient,
  setStatusAsStaff,
  updateDetailsAsStaff,
} from '../appointments';
import { computeSlots } from '../availability';
import { requirePatientOrThrow, requirePermissionOrThrow, requireUserOrThrow } from '../session';

const modalitySchema = z.enum(['PRESENCIAL', 'ONLINE']);
const isoDate = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v));

/* ───────────────────── Horários disponíveis ───────────────────── */

const slotsSchema = z.object({
  serviceTypeId: z.string().min(1),
  modality: modalitySchema,
  fromYmd: ymdSchema,
  toYmd: ymdSchema,
  excludeAppointmentId: z.string().optional(),
});

export type SlotDTO = { startsAt: string; endsAt: string };

/** Qualquer usuário autenticado pode CONSULTAR horários livres (não expõe quem ocupa). */
export async function getSlotsAction(input: unknown): Promise<ActionResult<SlotDTO[]>> {
  return run(async () => {
    const user = await requireUserOrThrow();
    const rl = await rateLimitByIp('slots', 120, 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));
    const data = slotsSchema.parse(input);

    // Limita o intervalo consultado (evita consultas gigantes)
    const maxTo = addDaysYmd(data.fromYmd, 62);
    if (data.toYmd > maxTo) throw new UserError('Intervalo muito grande.');

    const service = await db.serviceType.findFirst({
      where: {
        id: data.serviceTypeId,
        deletedAt: null,
        ...(user.role === 'PACIENTE' ? { active: true } : {}),
      },
    });
    if (!service) throw new UserError('Serviço não encontrado.');

    // Paciente só pode excluir da checagem uma sessão que lhe pertence
    let excludeId: string | undefined;
    if (data.excludeAppointmentId) {
      const own = await db.appointment.findFirst({
        where: {
          id: data.excludeAppointmentId,
          deletedAt: null,
          ...(user.role === 'PACIENTE' ? { patientId: user.patientProfile?.id ?? '__none__' } : {}),
        },
        select: { id: true },
      });
      excludeId = own?.id;
    }

    const slots = await computeSlots({
      durationMinutes: service.durationMinutes,
      modality: data.modality,
      fromYmd: data.fromYmd,
      toYmd: data.toYmd,
      excludeAppointmentId: excludeId,
    });
    return ok(
      undefined,
      slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
    );
  });
}

/* ───────────────────── Paciente ───────────────────── */

const bookSchema = z.object({
  serviceTypeId: z.string().min(1),
  modality: modalitySchema,
  startsAt: isoDate,
});

export async function bookAppointmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string; pending: boolean }>> {
  return run(async () => {
    const user = await requirePatientOrThrow();
    const data = bookSchema.parse(input);
    const appt = await bookAsPatient(user, data);
    revalidatePath('/paciente', 'layout');
    return ok(
      appt.status === 'PENDENTE'
        ? 'Pedido enviado! Você receberá um e-mail quando o horário for confirmado.'
        : 'Sessão agendada! Enviamos a confirmação por e-mail.',
      { id: appt.id, pending: appt.status === 'PENDENTE' },
    );
  });
}

export async function patientCancelAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePatientOrThrow();
    const { id, reason } = z.object({ id: z.string(), reason: optionalTrimmed(300) }).parse(input);
    await cancelAsPatient(user, id, reason);
    revalidatePath('/paciente', 'layout');
    return ok('Sessão cancelada.');
  });
}

export async function patientRescheduleAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePatientOrThrow();
    const { id, startsAt } = z.object({ id: z.string(), startsAt: isoDate }).parse(input);
    await rescheduleAsPatient(user, id, startsAt);
    revalidatePath('/paciente', 'layout');
    return ok('Sessão remarcada!');
  });
}

/* ───────────────────── Equipe ───────────────────── */

const staffCreateSchema = z.object({
  patientId: z.string().min(1),
  serviceTypeId: z.string().min(1),
  startsAt: isoDate,
  modality: modalitySchema,
  meetingUrl: z.string().trim().url().optional().or(z.literal('')),
  status: z.enum(['AGENDADA', 'CONFIRMADA']).optional(),
  priceCents: z.number().int().min(0).optional(),
  packageId: z.string().optional().or(z.literal('')),
  adminNote: optionalTrimmed(500),
  notifyPatient: z.boolean().optional(),
  recurrence: z
    .object({
      frequency: z.enum(['SEMANAL', 'QUINZENAL']),
      untilYmd: ymdSchema.optional(),
      count: z.number().int().min(1).max(52).optional(),
    })
    .optional(),
});

export async function staffCreateAppointmentAction(
  input: unknown,
): Promise<ActionResult<{ created: number; skipped: string[] }>> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('agenda.manage');
    const d = staffCreateSchema.parse(input);
    const res = await createAsStaff(actor, {
      ...d,
      meetingUrl: d.meetingUrl || undefined,
      packageId: d.packageId || undefined,
    });
    revalidatePath('/admin', 'layout');
    const extra = res.skipped.length
      ? ` ${res.skipped.length} data(s) foram puladas por conflito de horário.`
      : '';
    return ok(`${res.created.length} sessão(ões) criada(s).${extra}`, {
      created: res.created.length,
      skipped: res.skipped,
    });
  });
}

export async function staffMoveAppointmentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('agenda.manage');
    const d = z
      .object({
        id: z.string(),
        startsAt: isoDate,
        scope: z.enum(['THIS', 'FOLLOWING']).default('THIS'),
        notify: z.boolean().default(true),
      })
      .parse(input);
    await moveAsStaff(actor, d.id, d.startsAt, d.scope, d.notify);
    revalidatePath('/admin', 'layout');
    return ok('Sessão remarcada. O paciente foi avisado por e-mail.');
  });
}

export async function staffSetStatusAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('agenda.manage');
    const d = z
      .object({
        id: z.string(),
        status: z.enum([
          'PENDENTE',
          'AGENDADA',
          'CONFIRMADA',
          'REALIZADA',
          'FALTA',
          'CANCELADA_PACIENTE',
          'CANCELADA_PSICOLOGA',
          'RECUSADA',
        ]),
        reason: optionalTrimmed(300),
        scope: z.enum(['THIS', 'FOLLOWING']).default('THIS'),
        notify: z.boolean().default(true),
      })
      .parse(input);
    await setStatusAsStaff(actor, d.id, d.status, {
      reason: d.reason,
      scope: d.scope,
      notify: d.notify,
    });
    revalidatePath('/admin', 'layout');
    return ok('Status atualizado.');
  });
}

export async function staffUpdateAppointmentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('agenda.manage');
    const d = z
      .object({
        id: z.string(),
        meetingUrl: z.string().trim().url().optional().or(z.literal('')),
        adminNote: optionalTrimmed(500),
        modality: modalitySchema.optional(),
        scope: z.enum(['THIS', 'FOLLOWING']).default('THIS'),
      })
      .parse(input);
    await updateDetailsAsStaff(
      actor,
      d.id,
      { meetingUrl: d.meetingUrl || null, adminNote: d.adminNote ?? null, modality: d.modality },
      d.scope,
    );
    revalidatePath('/admin', 'layout');
    return ok('Sessão atualizada.');
  });
}

export async function staffDeleteAppointmentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('agenda.manage');
    const { id } = z.object({ id: z.string() }).parse(input);
    await deleteAsStaff(actor, id);
    revalidatePath('/admin', 'layout');
    return ok('Sessão excluída.');
  });
}

/* ───────────────────── Agenda (dados do calendário) ───────────────────── */

export interface CalendarEventDTO {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  modality: string;
  patientId: string;
  patientName: string;
  serviceName: string;
  meetingUrl: string | null;
  recurrenceId: string | null;
  adminNote: string | null;
  priceCents: number;
  paymentStatus: string | null;
}

export interface BlockDTO {
  id: string;
  start: string;
  end: string;
  reason: string | null;
}

/** Eventos do calendário para o intervalo visível (apenas equipe). */
export async function getCalendarDataAction(
  input: unknown,
): Promise<ActionResult<{ events: CalendarEventDTO[]; blocks: BlockDTO[] }>> {
  return run(async () => {
    await requirePermissionOrThrow('agenda.manage');
    const { start, end } = z.object({ start: isoDate, end: isoDate }).parse(input);
    if (end.getTime() - start.getTime() > 70 * 24 * 3600 * 1000)
      throw new UserError('Intervalo muito grande.');

    const [appts, blocks] = await Promise.all([
      db.appointment.findMany({
        where: { deletedAt: null, startsAt: { lt: end }, endsAt: { gt: start } },
        include: {
          patient: { select: { fullName: true, socialName: true } },
          serviceType: { select: { name: true } },
          payment: { select: { status: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 1000,
      }),
      db.availabilityBlock.findMany({ where: { startsAt: { lt: end }, endsAt: { gt: start } } }),
    ]);

    return ok(undefined, {
      events: appts.map((a) => ({
        id: a.id,
        title: a.patient.socialName ?? a.patient.fullName,
        start: a.startsAt.toISOString(),
        end: a.endsAt.toISOString(),
        status: a.status,
        modality: a.modality,
        patientId: a.patientId,
        patientName: a.patient.fullName,
        serviceName: a.serviceType.name,
        meetingUrl: a.meetingUrl,
        recurrenceId: a.recurrenceId,
        adminNote: a.adminNote,
        priceCents: a.priceCents,
        paymentStatus: a.payment?.status ?? null,
      })),
      blocks: blocks.map((b) => ({
        id: b.id,
        start: b.startsAt.toISOString(),
        end: b.endsAt.toISOString(),
        reason: b.reason,
      })),
    });
  });
}
