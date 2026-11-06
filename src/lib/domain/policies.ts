import { differenceInMinutes } from 'date-fns';

/** Status que ocupam horário na agenda (espelha a EXCLUDE constraint do banco). */
export const OCCUPYING_STATUSES = [
  'PENDENTE',
  'AGENDADA',
  'CONFIRMADA',
  'REALIZADA',
  'FALTA',
] as const;

/** Status de sessão ainda "viva" para o paciente (pode ser remarcada/cancelada). */
export const OPEN_STATUSES = ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] as const;

export type OccupyingStatus = (typeof OCCUPYING_STATUSES)[number];

export function isOpenStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

export interface CancellationDecision {
  allowed: boolean;
  /** Horas que faltam até a sessão (pode ser negativo). */
  hoursLeft: number;
  reason?: 'TOO_LATE' | 'ALREADY_STARTED';
}

/**
 * Pode o paciente cancelar/remarcar? Só se faltar pelo menos `minHours` horas.
 * Fora do prazo o sistema orienta contato direto (a decisão fica com a psicóloga).
 */
export function evaluateCancellation(
  startsAt: Date,
  now: Date,
  minHours: number,
): CancellationDecision {
  const minutesLeft = differenceInMinutes(startsAt, now);
  const hoursLeft = minutesLeft / 60;
  if (minutesLeft <= 0) return { allowed: false, hoursLeft, reason: 'ALREADY_STARTED' };
  if (hoursLeft < minHours) return { allowed: false, hoursLeft, reason: 'TOO_LATE' };
  return { allowed: true, hoursLeft };
}

/** O link da sessão online só aparece perto do horário (padrão: 15 min antes) até o fim da sessão. */
export function canShowMeetingLink(
  startsAt: Date,
  endsAt: Date,
  now: Date,
  minutesBefore = 15,
): boolean {
  const opensAt = startsAt.getTime() - minutesBefore * 60_000;
  return now.getTime() >= opensAt && now.getTime() <= endsAt.getTime();
}

/** Valor da sessão: preço do paciente > preço do serviço > padrão geral. */
export function resolvePriceCents(opts: {
  patientCustomCents?: number | null;
  serviceCents?: number | null;
  defaultCents: number;
}): number {
  if (opts.patientCustomCents != null) return opts.patientCustomCents;
  if (opts.serviceCents != null && opts.serviceCents > 0) return opts.serviceCents;
  return opts.defaultCents;
}

/** Saldo de um pacote: sessões ainda disponíveis (nunca negativo). */
export function packageBalance(totalSessions: number, consumed: number): number {
  return Math.max(0, totalSessions - consumed);
}

/** Valida limite de sessões futuras abertas por paciente. */
export function exceedsFutureLimit(openFutureCount: number, limit: number): boolean {
  return limit > 0 && openFutureCount >= limit;
}

/** Janela em que um lembrete deve sair: `hoursBefore` antes, mas apenas se ainda faltar tempo. */
export function reminderDue(startsAt: Date, now: Date, hoursBefore: number): boolean {
  const msLeft = startsAt.getTime() - now.getTime();
  return msLeft > 0 && msLeft <= hoursBefore * 3_600_000;
}
