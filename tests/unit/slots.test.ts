import { describe, expect, it } from 'vitest';
import { getAvailableSlots, isSlotAvailable, type SlotQuery } from '@/lib/domain/slots';
import { localToUtc } from '@/lib/domain/time';

// Segunda-feira, 2026-03-02 (fuso America/Sao_Paulo = UTC-3, sem horário de verão em 2026)
const MON = '2026-03-02';
const TUE = '2026-03-03';

const base = (over: Partial<SlotQuery> = {}): SlotQuery => ({
  rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60, modality: null }],
  blocks: [],
  busy: [],
  now: localToUtc('2026-03-01', 8 * 60), // domingo 08:00
  fromYmd: MON,
  toYmd: MON,
  durationMinutes: 50,
  gapMinutes: 10,
  stepMinutes: 60,
  minAdvanceHours: 12,
  maxAdvanceDays: 60,
  modality: 'ONLINE',
  ...over,
});

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);

describe('getAvailableSlots', () => {
  it('gera horários dentro da janela de atendimento', () => {
    const slots = getAvailableSlots(base());
    expect(slots.map((s) => hhmm(s.startsAt))).toEqual(['09:00', '10:00', '11:00']);
  });

  it('cada horário tem a duração do serviço', () => {
    const [s] = getAvailableSlots(base({ durationMinutes: 80 }));
    expect(s!.endsAt.getTime() - s!.startsAt.getTime()).toBe(80 * 60_000);
  });

  it('não oferece horário que não cabe inteiro na janela', () => {
    // sessão de 80 min com passo de 60: 09:00, 10:00 cabem (termina 11:20); 11:00 terminaria 12:20 → fora
    const slots = getAvailableSlots(base({ durationMinutes: 80 }));
    expect(slots.map((s) => hhmm(s.startsAt))).toEqual(['09:00', '10:00']);
  });

  it('ignora dias sem regra de atendimento', () => {
    expect(getAvailableSlots(base({ fromYmd: TUE, toYmd: TUE }))).toHaveLength(0);
  });

  it('respeita a modalidade da regra', () => {
    const rules = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60, modality: 'PRESENCIAL' as const },
      { weekday: 1, startMinute: 14 * 60, endMinute: 15 * 60, modality: 'ONLINE' as const },
    ];
    expect(
      getAvailableSlots(base({ rules, modality: 'ONLINE' })).map((s) => hhmm(s.startsAt)),
    ).toEqual(['14:00']);
    expect(
      getAvailableSlots(base({ rules, modality: 'PRESENCIAL' })).map((s) => hhmm(s.startsAt)),
    ).toEqual(['09:00']);
  });

  it('remove horários ocupados por outra sessão', () => {
    const busy = [{ startsAt: localToUtc(MON, 10 * 60), endsAt: localToUtc(MON, 10 * 60 + 50) }];
    const slots = getAvailableSlots(base({ busy, gapMinutes: 0 }));
    expect(slots.map((s) => hhmm(s.startsAt))).toEqual(['09:00', '11:00']);
  });

  it('aplica o intervalo de descanso entre sessões', () => {
    // Sessão 10:00–10:50 com 15 min de intervalo bloqueia 09:00 (termina 09:50, +15 > 09:45)? 09:00–09:50 toca [09:45,11:05)
    const busy = [{ startsAt: localToUtc(MON, 10 * 60), endsAt: localToUtc(MON, 10 * 60 + 50) }];
    const slots = getAvailableSlots(base({ busy, gapMinutes: 15 }));
    expect(slots.map((s) => hhmm(s.startsAt))).toEqual([]);
  });

  it('sessões coladas (sem intervalo configurado) não se sobrepõem', () => {
    const busy = [{ startsAt: localToUtc(MON, 9 * 60), endsAt: localToUtc(MON, 9 * 60 + 50) }];
    const slots = getAvailableSlots(base({ busy, gapMinutes: 0, stepMinutes: 50 }));
    expect(hhmm(slots[0]!.startsAt)).toBe('09:50');
  });

  it('remove horários que tocam um bloqueio', () => {
    const blocks = [
      { startsAt: localToUtc(MON, 10 * 60 + 30), endsAt: localToUtc(MON, 11 * 60 + 30) },
    ];
    const slots = getAvailableSlots(base({ blocks }));
    expect(slots.map((s) => hhmm(s.startsAt))).toEqual(['09:00']);
  });

  it('bloqueio de dia inteiro elimina todos os horários', () => {
    const blocks = [{ startsAt: localToUtc(MON, 0), endsAt: localToUtc(TUE, 0) }];
    expect(getAvailableSlots(base({ blocks }))).toHaveLength(0);
  });

  it('respeita a antecedência mínima', () => {
    // agora = segunda 08:00, antecedência 12h → só a partir de 20:00 → nada na segunda de manhã
    const now = localToUtc(MON, 8 * 60);
    expect(getAvailableSlots(base({ now }))).toHaveLength(0);
    // agora = domingo 21:00 → limite segunda 09:00 → 09:00 já é permitido (>=)
    const now2 = localToUtc('2026-03-01', 21 * 60);
    expect(hhmm(getAvailableSlots(base({ now: now2 }))[0]!.startsAt)).toBe('09:00');
  });

  it('respeita o horizonte máximo de agendamento', () => {
    const slots = getAvailableSlots(base({ maxAdvanceDays: 0 }));
    expect(slots).toHaveLength(0);
  });

  it('múltiplos intervalos no mesmo dia e sem duplicatas', () => {
    const rules = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 11 * 60, modality: null },
      { weekday: 1, startMinute: 10 * 60, endMinute: 12 * 60, modality: null }, // sobreposta
      { weekday: 1, startMinute: 14 * 60, endMinute: 15 * 60, modality: null },
    ];
    const slots = getAvailableSlots(base({ rules }));
    expect(slots.map((s) => hhmm(s.startsAt))).toEqual(['09:00', '10:00', '11:00', '14:00']);
  });

  it('ignora regras inativas', () => {
    const rules = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60, modality: null, active: false },
    ];
    expect(getAvailableSlots(base({ rules }))).toHaveLength(0);
  });

  it('converte corretamente para UTC (UTC-3)', () => {
    const [s] = getAvailableSlots(base());
    expect(s!.startsAt.toISOString()).toBe('2026-03-02T12:00:00.000Z');
  });
});

describe('isSlotAvailable', () => {
  const { fromYmd: _f, toYmd: _t, ...q } = base();

  it('aceita um horário oferecido', () => {
    expect(isSlotAvailable(localToUtc(MON, 10 * 60), q)).toBe(true);
  });
  it('rejeita horário forjado fora da grade', () => {
    expect(isSlotAvailable(localToUtc(MON, 10 * 60 + 17), q)).toBe(false);
  });
  it('rejeita horário já ocupado', () => {
    const busy = [{ startsAt: localToUtc(MON, 10 * 60), endsAt: localToUtc(MON, 10 * 60 + 50) }];
    expect(isSlotAvailable(localToUtc(MON, 10 * 60), { ...q, busy })).toBe(false);
  });
});
