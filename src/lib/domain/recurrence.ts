import { addMinutes } from 'date-fns';
import { addDaysYmd, localToUtc, TZ, weekdayOfYmd } from './time';

export interface RecurrenceInput {
  frequency: 'SEMANAL' | 'QUINZENAL';
  /** Primeira data possível (YYYY-MM-DD, local). A série começa no primeiro `weekday` a partir dela. */
  startYmd: string;
  weekday: number;
  startMinute: number;
  durationMinutes: number;
  /** Fim da série (inclusive) – ou use `count`. */
  untilYmd?: string;
  count?: number;
  tz?: string;
}

/** Limite de segurança: no máximo 1 ano de sessões por série. */
export const MAX_OCCURRENCES = 52;

export interface Occurrence {
  index: number;
  startsAt: Date;
  endsAt: Date;
  ymd: string;
}

/**
 * Gera as datas de uma série semanal/quinzenal. Cada ocorrência é calculada pelo
 * horário LOCAL (a sessão das 10h continua às 10h mesmo se o fuso mudar de offset).
 */
export function generateOccurrences(input: RecurrenceInput): Occurrence[] {
  const tz = input.tz ?? TZ;
  if (!input.untilYmd && !input.count) {
    throw new Error('Informe `untilYmd` ou `count` para a recorrência.');
  }

  // Avança até o primeiro dia da semana desejado.
  let ymd = input.startYmd;
  while (weekdayOfYmd(ymd) !== input.weekday) ymd = addDaysYmd(ymd, 1);

  const stepDays = input.frequency === 'SEMANAL' ? 7 : 14;
  const max = Math.min(input.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const out: Occurrence[] = [];

  for (let i = 0; i < max; i++) {
    if (input.untilYmd && ymd > input.untilYmd) break;
    const startsAt = localToUtc(ymd, input.startMinute, tz);
    out.push({ index: i, ymd, startsAt, endsAt: addMinutes(startsAt, input.durationMinutes) });
    ymd = addDaysYmd(ymd, stepDays);
  }
  return out;
}
