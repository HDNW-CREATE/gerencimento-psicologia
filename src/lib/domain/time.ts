import { addDays, addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

/** Fuso padrão do consultório. Datas são guardadas em UTC; convertemos só na borda. */
export const TZ = 'America/Sao_Paulo';

/** "2026-03-10" + minutos desde 00:00 locais → instante UTC. */
export function localToUtc(dateYmd: string, minutesFromMidnight: number, tz = TZ): Date {
  const h = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0');
  const m = String(minutesFromMidnight % 60).padStart(2, '0');
  return fromZonedTime(`${dateYmd}T${h}:${m}:00`, tz);
}

/** Instante UTC → "YYYY-MM-DD" no fuso do consultório. */
export function utcToLocalYmd(date: Date, tz = TZ): string {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

/** Dia da semana (0 = domingo) de uma data "YYYY-MM-DD" – independente do fuso do servidor. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** Soma dias a uma data "YYYY-MM-DD" (aritmética de calendário, sem fuso). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(y!, m! - 1, d!));
  return addDays(base, days).toISOString().slice(0, 10);
}

/** Minutos desde 00:00 locais de um instante. */
export function minutesOfDayLocal(date: Date, tz = TZ): number {
  const z = toZonedTime(date, tz);
  return z.getHours() * 60 + z.getMinutes();
}

export function startOfLocalDayUtc(ymd: string, tz = TZ): Date {
  return localToUtc(ymd, 0, tz);
}

export function endOfLocalDayUtc(ymd: string, tz = TZ): Date {
  return localToUtc(addDaysYmd(ymd, 1), 0, tz);
}

export function addMinutesUtc(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

export function isValidYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function parseHHmm(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return h! * 60 + (m ?? 0);
}
