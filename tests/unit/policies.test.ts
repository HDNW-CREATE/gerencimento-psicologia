import { describe, expect, it } from 'vitest';
import {
  canShowMeetingLink,
  evaluateCancellation,
  exceedsFutureLimit,
  isOpenStatus,
  packageBalance,
  reminderDue,
  resolvePriceCents,
} from '@/lib/domain/policies';
import { generateOccurrences } from '@/lib/domain/recurrence';
import { can } from '@/lib/permissions';

const at = (iso: string) => new Date(iso);

describe('evaluateCancellation (prazo mínimo)', () => {
  const start = at('2026-03-10T15:00:00Z');
  it('permite com antecedência suficiente', () => {
    const r = evaluateCancellation(start, at('2026-03-09T14:00:00Z'), 24);
    expect(r.allowed).toBe(true);
  });
  it('permite exatamente no limite de 24h', () => {
    expect(evaluateCancellation(start, at('2026-03-09T15:00:00Z'), 24).allowed).toBe(true);
  });
  it('bloqueia dentro do prazo mínimo', () => {
    const r = evaluateCancellation(start, at('2026-03-09T16:00:00Z'), 24);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('TOO_LATE');
  });
  it('bloqueia sessão já iniciada', () => {
    const r = evaluateCancellation(start, at('2026-03-10T15:30:00Z'), 24);
    expect(r.reason).toBe('ALREADY_STARTED');
  });
  it('com prazo 0 permite até o início', () => {
    expect(evaluateCancellation(start, at('2026-03-10T14:59:00Z'), 0).allowed).toBe(true);
  });
});

describe('canShowMeetingLink', () => {
  const s = at('2026-03-10T15:00:00Z');
  const e = at('2026-03-10T15:50:00Z');
  it('oculta antes da janela', () =>
    expect(canShowMeetingLink(s, e, at('2026-03-10T14:40:00Z'))).toBe(false));
  it('mostra 15 min antes', () =>
    expect(canShowMeetingLink(s, e, at('2026-03-10T14:45:00Z'))).toBe(true));
  it('mostra durante a sessão', () =>
    expect(canShowMeetingLink(s, e, at('2026-03-10T15:20:00Z'))).toBe(true));
  it('oculta após o fim', () =>
    expect(canShowMeetingLink(s, e, at('2026-03-10T15:51:00Z'))).toBe(false));
});

describe('preço, pacote e limites', () => {
  it('prioriza preço do paciente', () =>
    expect(
      resolvePriceCents({ patientCustomCents: 15000, serviceCents: 20000, defaultCents: 18000 }),
    ).toBe(15000));
  it('permite preço do paciente = 0 (gratuito)', () =>
    expect(
      resolvePriceCents({ patientCustomCents: 0, serviceCents: 20000, defaultCents: 18000 }),
    ).toBe(0));
  it('cai no serviço, depois no padrão', () => {
    expect(resolvePriceCents({ serviceCents: 20000, defaultCents: 18000 })).toBe(20000);
    expect(resolvePriceCents({ serviceCents: 0, defaultCents: 18000 })).toBe(18000);
  });
  it('saldo do pacote nunca é negativo', () => {
    expect(packageBalance(4, 1)).toBe(3);
    expect(packageBalance(4, 9)).toBe(0);
  });
  it('limite de sessões futuras', () => {
    expect(exceedsFutureLimit(3, 3)).toBe(true);
    expect(exceedsFutureLimit(2, 3)).toBe(false);
    expect(exceedsFutureLimit(10, 0)).toBe(false); // 0 = sem limite
  });
  it('status em aberto', () => {
    expect(isOpenStatus('CONFIRMADA')).toBe(true);
    expect(isOpenStatus('REALIZADA')).toBe(false);
  });
});

describe('reminderDue', () => {
  const start = at('2026-03-10T15:00:00Z');
  it('dispara dentro da janela de 24h', () =>
    expect(reminderDue(start, at('2026-03-09T20:00:00Z'), 24)).toBe(true));
  it('não dispara cedo demais', () =>
    expect(reminderDue(start, at('2026-03-08T15:00:00Z'), 24)).toBe(false));
  it('não dispara depois do início', () =>
    expect(reminderDue(start, at('2026-03-10T15:01:00Z'), 24)).toBe(false));
});

describe('generateOccurrences', () => {
  it('semanal: mesmo dia e horário local', () => {
    const occ = generateOccurrences({
      frequency: 'SEMANAL',
      startYmd: '2026-03-02',
      weekday: 1,
      startMinute: 10 * 60,
      durationMinutes: 50,
      count: 4,
    });
    expect(occ.map((o) => o.ymd)).toEqual(['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23']);
    expect(occ[0]!.startsAt.toISOString()).toBe('2026-03-02T13:00:00.000Z');
  });
  it('quinzenal pula uma semana', () => {
    const occ = generateOccurrences({
      frequency: 'QUINZENAL',
      startYmd: '2026-03-02',
      weekday: 1,
      startMinute: 600,
      durationMinutes: 50,
      untilYmd: '2026-04-06',
    });
    expect(occ.map((o) => o.ymd)).toEqual(['2026-03-02', '2026-03-16', '2026-03-30']);
  });
  it('começa no primeiro dia da semana pedido', () => {
    const occ = generateOccurrences({
      frequency: 'SEMANAL',
      startYmd: '2026-03-02',
      weekday: 3,
      startMinute: 600,
      durationMinutes: 50,
      count: 1,
    });
    expect(occ[0]!.ymd).toBe('2026-03-04');
  });
  it('limita a 52 ocorrências', () => {
    const occ = generateOccurrences({
      frequency: 'SEMANAL',
      startYmd: '2026-03-02',
      weekday: 1,
      startMinute: 600,
      durationMinutes: 50,
      count: 500,
    });
    expect(occ).toHaveLength(52);
  });
  it('exige fim ou contagem', () => {
    expect(() =>
      generateOccurrences({
        frequency: 'SEMANAL',
        startYmd: '2026-03-02',
        weekday: 1,
        startMinute: 600,
        durationMinutes: 50,
      }),
    ).toThrow();
  });
});

describe('permissões', () => {
  it('somente ADMIN acessa prontuário', () => {
    expect(can('ADMIN', 'clinical.read')).toBe(true);
    expect(can('ADMIN', 'clinical.write')).toBe(true);
    expect(can('SECRETARIA', 'clinical.read')).toBe(false);
    expect(can('SECRETARIA', 'clinical.write')).toBe(false);
    expect(can('PACIENTE', 'clinical.read')).toBe(false);
  });
  it('SECRETARIA acessa agenda e financeiro, mas não configurações', () => {
    expect(can('SECRETARIA', 'agenda.manage')).toBe(true);
    expect(can('SECRETARIA', 'finance.manage')).toBe(true);
    expect(can('SECRETARIA', 'settings.manage')).toBe(false);
    expect(can('SECRETARIA', 'audit.read')).toBe(false);
  });
  it('PACIENTE não tem nenhuma permissão administrativa', () => {
    for (const p of [
      'agenda.manage',
      'patients.read',
      'finance.manage',
      'settings.manage',
      'lgpd.manage',
    ] as const) {
      expect(can('PACIENTE', p)).toBe(false);
    }
  });
  it('sem papel = sem acesso', () => {
    expect(can(undefined, 'agenda.manage')).toBe(false);
    expect(can(null, 'clinical.read')).toBe(false);
  });
});
