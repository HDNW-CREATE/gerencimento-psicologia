import { addMinutes } from 'date-fns';
import { addDaysYmd, localToUtc, TZ, utcToLocalYmd, weekdayOfYmd } from './time';

export type Modality = 'PRESENCIAL' | 'ONLINE';

export interface WeeklyRule {
  weekday: number; // 0 = domingo
  startMinute: number;
  endMinute: number;
  modality: Modality | null; // null = vale para ambas
  active?: boolean;
}

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

export interface SlotQuery {
  /** Regras semanais de atendimento. */
  rules: WeeklyRule[];
  /** Bloqueios (férias, feriados, compromissos). */
  blocks: Interval[];
  /** Sessões que ocupam horário (pendente/agendada/confirmada/realizada/falta). */
  busy: Interval[];
  /** "Agora" – injetado para ser testável. */
  now: Date;
  /** Primeiro e último dia (inclusive) no formato YYYY-MM-DD, fuso do consultório. */
  fromYmd: string;
  toYmd: string;
  durationMinutes: number;
  /** Intervalo de descanso entre sessões. */
  gapMinutes: number;
  /** De quanto em quanto tempo um horário pode começar (ex.: 60). */
  stepMinutes: number;
  /** Antecedência mínima para agendar (horas). */
  minAdvanceHours: number;
  /** Até quantos dias à frente se pode agendar. */
  maxAdvanceDays: number;
  modality: Modality;
  tz?: string;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd; // intervalos semiabertos [início, fim)
}

/**
 * Motor de horários disponíveis. Função PURA (sem banco), totalmente testável.
 *
 * Um horário é oferecido se:
 *  - cabe inteiro dentro de uma janela de atendimento do dia da semana (compatível com a modalidade);
 *  - começa respeitando a antecedência mínima e o horizonte máximo;
 *  - não toca nenhum bloqueio;
 *  - não conflita com sessão existente (considerando o intervalo `gapMinutes` antes e depois dela).
 */
export function getAvailableSlots(q: SlotQuery): Slot[] {
  const tz = q.tz ?? TZ;
  const earliest = addMinutes(q.now, q.minAdvanceHours * 60);
  const latest = addMinutes(q.now, q.maxAdvanceDays * 24 * 60);
  const slots: Slot[] = [];

  // Sessões existentes "engordadas" pelo intervalo de descanso.
  const paddedBusy = q.busy.map((b) => ({
    startsAt: addMinutes(b.startsAt, -q.gapMinutes),
    endsAt: addMinutes(b.endsAt, q.gapMinutes),
  }));

  const step = Math.max(5, q.stepMinutes);

  for (let ymd = q.fromYmd; ymd <= q.toYmd; ymd = addDaysYmd(ymd, 1)) {
    const weekday = weekdayOfYmd(ymd);
    const windows = q.rules.filter(
      (r) =>
        r.active !== false &&
        r.weekday === weekday &&
        (r.modality === null || r.modality === q.modality),
    );

    for (const w of windows) {
      for (let start = w.startMinute; start + q.durationMinutes <= w.endMinute; start += step) {
        const startsAt = localToUtc(ymd, start, tz);
        const endsAt = addMinutes(startsAt, q.durationMinutes);

        if (startsAt < earliest) continue;
        if (startsAt > latest) continue;
        if (q.blocks.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt))) continue;
        if (paddedBusy.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt))) continue;

        slots.push({ startsAt, endsAt });
      }
    }
  }

  // Janelas sobrepostas podem gerar o mesmo horário duas vezes: remove duplicatas e ordena.
  const seen = new Set<number>();
  return slots
    .filter((s) => {
      const k = s.startsAt.getTime();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Valida UM horário específico com as mesmas regras do motor.
 * Usada dentro da transação de agendamento para impedir horários forjados pelo cliente.
 */
export function isSlotAvailable(startsAt: Date, q: Omit<SlotQuery, 'fromYmd' | 'toYmd'>): boolean {
  const tz = q.tz ?? TZ;
  const ymd = utcToLocalYmd(startsAt, tz);
  const slots = getAvailableSlots({ ...q, fromYmd: ymd, toYmd: ymd });
  return slots.some((s) => s.startsAt.getTime() === startsAt.getTime());
}
