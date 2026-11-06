import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getAvailableSlots, isSlotAvailable, type Modality, type Slot } from '@/lib/domain/slots';
import { OCCUPYING_STATUSES } from '@/lib/domain/policies';
import { addDaysYmd, endOfLocalDayUtc, startOfLocalDayUtc, utcToLocalYmd } from '@/lib/domain/time';
import { getScheduling } from '@/lib/settings';

type Client = Prisma.TransactionClient | typeof db;

export interface SlotRequest {
  durationMinutes: number;
  modality: Modality;
  fromYmd: string;
  toYmd: string;
  /** Ao remarcar, ignora a própria sessão na checagem de conflito. */
  excludeAppointmentId?: string;
  now?: Date;
  client?: Client;
}

/** Monta o contexto do motor (regras, bloqueios, sessões ocupadas) a partir do banco. */
async function buildContext(
  req: Pick<SlotRequest, 'fromYmd' | 'toYmd' | 'excludeAppointmentId' | 'client'>,
) {
  const client = req.client ?? db;
  const scheduling = await getScheduling();
  // Margem de 1 dia nas bordas para o intervalo de descanso atravessar a virada do dia.
  const from = startOfLocalDayUtc(addDaysYmd(req.fromYmd, -1));
  const to = endOfLocalDayUtc(addDaysYmd(req.toYmd, 1));

  const [rules, blocks, busy] = await Promise.all([
    client.availabilityRule.findMany({ where: { active: true } }),
    client.availabilityBlock.findMany({ where: { startsAt: { lt: to }, endsAt: { gt: from } } }),
    client.appointment.findMany({
      where: {
        deletedAt: null,
        status: { in: [...OCCUPYING_STATUSES] },
        startsAt: { lt: to },
        endsAt: { gt: from },
        ...(req.excludeAppointmentId ? { id: { not: req.excludeAppointmentId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  return { scheduling, rules, blocks, busy };
}

export async function computeSlots(req: SlotRequest): Promise<Slot[]> {
  const ctx = await buildContext(req);
  return getAvailableSlots({
    rules: ctx.rules.map((r) => ({
      weekday: r.weekday,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
      modality: r.modality,
    })),
    blocks: ctx.blocks,
    busy: ctx.busy,
    now: req.now ?? new Date(),
    fromYmd: req.fromYmd,
    toYmd: req.toYmd,
    durationMinutes: req.durationMinutes,
    gapMinutes: ctx.scheduling.gapMinutes,
    stepMinutes: ctx.scheduling.stepMinutes,
    minAdvanceHours: ctx.scheduling.minAdvanceHours,
    maxAdvanceDays: ctx.scheduling.maxAdvanceDays,
    modality: req.modality,
  });
}

/** Revalida UM horário (usado dentro da transação de agendamento). */
export async function assertSlotAvailable(
  startsAt: Date,
  req: Omit<SlotRequest, 'fromYmd' | 'toYmd'>,
): Promise<boolean> {
  const ymd = utcToLocalYmd(startsAt);
  const ctx = await buildContext({ ...req, fromYmd: ymd, toYmd: ymd });
  return isSlotAvailable(startsAt, {
    rules: ctx.rules.map((r) => ({
      weekday: r.weekday,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
      modality: r.modality,
    })),
    blocks: ctx.blocks,
    busy: ctx.busy,
    now: req.now ?? new Date(),
    durationMinutes: req.durationMinutes,
    gapMinutes: ctx.scheduling.gapMinutes,
    stepMinutes: ctx.scheduling.stepMinutes,
    minAdvanceHours: ctx.scheduling.minAdvanceHours,
    maxAdvanceDays: ctx.scheduling.maxAdvanceDays,
    modality: req.modality,
  });
}

/** Conflito "duro" (sobreposição real de horário) para agendamentos feitos pela equipe. */
export async function hasHardConflict(
  client: Client,
  startsAt: Date,
  endsAt: Date,
  excludeId?: string,
): Promise<boolean> {
  const count = await client.appointment.count({
    where: {
      deletedAt: null,
      status: { in: [...OCCUPYING_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return count > 0;
}
