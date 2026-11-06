import { beforeEach, describe, expect, it } from 'vitest';
import { addHours } from 'date-fns';
import { db } from '@/lib/db';
import { computeSlots } from '@/server/availability';
import {
  bookAsPatient,
  cancelAsPatient,
  createAsStaff,
  rescheduleAsPatient,
  setStatusAsStaff,
} from '@/server/appointments';
import { addDaysYmd, utcToLocalYmd } from '@/lib/domain/time';
import { baseFixtures, makeUser, resetDb } from './helpers';
import type { SessionUser } from '@/server/session';

type Patient = SessionUser & { patientProfile: NonNullable<SessionUser['patientProfile']> };
const asPatient = (u: SessionUser) => u as Patient;

async function freeSlots(durationMinutes = 50, days = 21) {
  const from = utcToLocalYmd(new Date());
  return computeSlots({
    durationMinutes,
    modality: 'ONLINE',
    fromYmd: from,
    toYmd: addDaysYmd(from, days),
  });
}

describe('agendamento (integração com PostgreSQL)', () => {
  let service: Awaited<ReturnType<typeof baseFixtures>>['service'];

  beforeEach(async () => {
    await resetDb();
    ({ service } = await baseFixtures());
  });

  it('dois pacientes disputando o MESMO horário: apenas um consegue', async () => {
    const [a, b] = await Promise.all([makeUser('a@t.com'), makeUser('b@t.com')]);
    const slots = await freeSlots();
    const slot = slots[0]!;

    const results = await Promise.allSettled([
      bookAsPatient(asPatient(a), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: slot.startsAt,
      }),
      bookAsPatient(asPatient(b), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: slot.startsAt,
      }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(String(rejected.reason.message)).toMatch(/ocupado/i);
    expect(await db.appointment.count({ where: { startsAt: slot.startsAt } })).toBe(1);
  });

  it('muitas tentativas simultâneas no mesmo horário: sempre exatamente uma vence', async () => {
    const users = await Promise.all(Array.from({ length: 6 }, (_, i) => makeUser(`u${i}@t.com`)));
    const slot = (await freeSlots())[2]!;
    const results = await Promise.allSettled(
      users.map((u) =>
        bookAsPatient(asPatient(u), {
          serviceTypeId: service.id,
          modality: 'ONLINE',
          startsAt: slot.startsAt,
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.appointment.count({ where: { startsAt: slot.startsAt } })).toBe(1);
  });

  it('o banco recusa sobreposição mesmo ignorando a aplicação (EXCLUDE constraint)', async () => {
    const u = await makeUser('c@t.com');
    const slot = (await freeSlots())[0]!;
    const base = {
      patientId: u.patientProfile!.id,
      serviceTypeId: service.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      modality: 'ONLINE' as const,
    };
    await db.appointment.create({ data: base });
    await expect(
      db.appointment.create({
        data: {
          ...base,
          startsAt: new Date(slot.startsAt.getTime() + 10 * 60_000),
          endsAt: new Date(slot.endsAt.getTime() + 10 * 60_000),
        },
      }),
    ).rejects.toThrow();
  });

  it('sessão cancelada libera o horário', async () => {
    const u = await makeUser('d@t.com');
    // precisa estar além do prazo mínimo de cancelamento (24h)
    const slot = (await freeSlots()).find(
      (s) => s.startsAt.getTime() > Date.now() + 48 * 3600_000,
    )!;
    const appt = await bookAsPatient(asPatient(u), {
      serviceTypeId: service.id,
      modality: 'ONLINE',
      startsAt: slot.startsAt,
    });
    await cancelAsPatient(u, appt.id);
    const again = await freeSlots();
    expect(again.some((s) => s.startsAt.getTime() === slot.startsAt.getTime())).toBe(true);
    // e outro paciente consegue agendar
    const other = await makeUser('e@t.com');
    await expect(
      bookAsPatient(asPatient(other), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: slot.startsAt,
      }),
    ).resolves.toBeTruthy();
  });

  it('e-mail não confirmado não pode agendar', async () => {
    const u = await makeUser('f@t.com', { verified: false });
    const slot = (await freeSlots())[0]!;
    await expect(
      bookAsPatient(asPatient(u), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: slot.startsAt,
      }),
    ).rejects.toThrow(/e-mail/i);
  });

  it('respeita o limite de sessões futuras em aberto', async () => {
    await db.setting.update({
      where: { key: 'scheduling' },
      data: {
        value: {
          manualApproval: false,
          maxFutureAppointments: 2,
          minAdvanceHours: 12,
          minCancelHours: 24,
        },
      },
    });
    const u = await makeUser('g@t.com');
    const slots = await freeSlots();
    // slots em dias diferentes
    const picks = [
      slots[0]!,
      slots.find((s) => utcToLocalYmd(s.startsAt) !== utcToLocalYmd(slots[0]!.startsAt))!,
    ];
    for (const s of picks)
      await bookAsPatient(asPatient(u), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: s.startsAt,
      });
    const third = slots.find(
      (s) =>
        !picks.includes(s) &&
        !picks.some((p) => utcToLocalYmd(p.startsAt) === utcToLocalYmd(s.startsAt)),
    )!;
    await expect(
      bookAsPatient(asPatient(u), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: third.startsAt,
      }),
    ).rejects.toThrow(/limite/i);
  });

  it('rejeita horário forjado (fora da grade/disponibilidade)', async () => {
    const u = await makeUser('h@t.com');
    const slot = (await freeSlots())[0]!;
    await expect(
      bookAsPatient(asPatient(u), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: new Date(slot.startsAt.getTime() + 17 * 60_000),
      }),
    ).rejects.toThrow();
    // Domingo às 03:00 nunca é atendimento
    await expect(
      bookAsPatient(asPatient(u), {
        serviceTypeId: service.id,
        modality: 'ONLINE',
        startsAt: addHours(new Date(), 24 * 40),
      }),
    ).rejects.toThrow();
  });

  it('paciente NÃO acessa/cancela sessão de outro paciente (troca de ID)', async () => {
    const [a, b] = await Promise.all([makeUser('i@t.com'), makeUser('j@t.com')]);
    const slot = (await freeSlots())[0]!;
    const appt = await bookAsPatient(asPatient(a), {
      serviceTypeId: service.id,
      modality: 'ONLINE',
      startsAt: slot.startsAt,
    });
    await expect(cancelAsPatient(b, appt.id)).rejects.toThrow(/não encontrada/i);
    await expect(rescheduleAsPatient(b, appt.id, (await freeSlots())[5]!.startsAt)).rejects.toThrow(
      /não encontrada/i,
    );
    expect((await db.appointment.findUnique({ where: { id: appt.id } }))!.status).toBe('AGENDADA');
  });

  it('bloqueia cancelamento dentro do prazo mínimo', async () => {
    const u = await makeUser('k@t.com');
    const slot = (await freeSlots())[0]!;
    const appt = await bookAsPatient(asPatient(u), {
      serviceTypeId: service.id,
      modality: 'ONLINE',
      startsAt: slot.startsAt,
    });
    // simula que a sessão está a 5 horas
    await db.appointment.update({
      where: { id: appt.id },
      data: { startsAt: addHours(new Date(), 5), endsAt: addHours(new Date(), 6) },
    });
    await expect(cancelAsPatient(u, appt.id)).rejects.toThrow(/prazo/i);
  });

  it('com aprovação manual, a sessão nasce PENDENTE; psicóloga confirma', async () => {
    await db.setting.update({
      where: { key: 'scheduling' },
      data: { value: { manualApproval: true, minAdvanceHours: 12 } },
    });
    const u = await makeUser('l@t.com');
    const admin = await makeUser('adm@t.com', { role: 'ADMIN' });
    const slot = (await freeSlots())[0]!;
    const appt = await bookAsPatient(asPatient(u), {
      serviceTypeId: service.id,
      modality: 'ONLINE',
      startsAt: slot.startsAt,
    });
    expect(appt.status).toBe('PENDENTE');
    // PENDENTE ocupa o horário
    expect((await freeSlots()).some((s) => s.startsAt.getTime() === slot.startsAt.getTime())).toBe(
      false,
    );
    await setStatusAsStaff(admin, appt.id, 'CONFIRMADA');
    expect((await db.appointment.findUnique({ where: { id: appt.id } }))!.status).toBe(
      'CONFIRMADA',
    );
  });

  it('recusar/cancelar isenta a cobrança pendente; falta mantém cobrança', async () => {
    const u = await makeUser('m@t.com');
    const admin = await makeUser('adm2@t.com', { role: 'ADMIN' });
    const slots = await freeSlots();
    const a1 = await bookAsPatient(asPatient(u), {
      serviceTypeId: service.id,
      modality: 'ONLINE',
      startsAt: slots[0]!.startsAt,
    });
    await setStatusAsStaff(admin, a1.id, 'CANCELADA_PSICOLOGA', { reason: 'imprevisto' });
    expect((await db.payment.findUnique({ where: { appointmentId: a1.id } }))!.status).toBe(
      'ISENTO',
    );

    const other = slots.find(
      (s) => utcToLocalYmd(s.startsAt) !== utcToLocalYmd(slots[0]!.startsAt),
    )!;
    const a2 = await bookAsPatient(asPatient(u), {
      serviceTypeId: service.id,
      modality: 'ONLINE',
      startsAt: other.startsAt,
    });
    await setStatusAsStaff(admin, a2.id, 'FALTA');
    expect((await db.payment.findUnique({ where: { appointmentId: a2.id } }))!.status).toBe(
      'PENDENTE',
    );
  });

  it('série semanal: cria as sessões e pula datas em conflito', async () => {
    const admin = await makeUser('adm3@t.com', { role: 'ADMIN' });
    const u = await makeUser('n@t.com');
    const slot = (await freeSlots())[0]!;

    // Ocupa a 3ª semana com outro paciente
    const other = await makeUser('o@t.com');
    const third = new Date(slot.startsAt.getTime() + 14 * 24 * 3600_000);
    await db.appointment.create({
      data: {
        patientId: other.patientProfile!.id,
        serviceTypeId: service.id,
        startsAt: third,
        endsAt: new Date(third.getTime() + 50 * 60_000),
        modality: 'ONLINE',
      },
    });

    const res = await createAsStaff(admin, {
      patientId: u.patientProfile!.id,
      serviceTypeId: service.id,
      startsAt: slot.startsAt,
      modality: 'ONLINE',
      recurrence: { frequency: 'SEMANAL', count: 4 },
      notifyPatient: false,
    });
    expect(res.created).toHaveLength(3);
    expect(res.skipped).toHaveLength(1);
  });

  it('staff não consegue criar sessão sobreposta (agendamento único)', async () => {
    const admin = await makeUser('adm4@t.com', { role: 'ADMIN' });
    const u = await makeUser('p@t.com');
    const slot = (await freeSlots())[0]!;
    const input = {
      patientId: u.patientProfile!.id,
      serviceTypeId: service.id,
      startsAt: slot.startsAt,
      modality: 'ONLINE' as const,
      notifyPatient: false,
    };
    await createAsStaff(admin, input);
    await expect(createAsStaff(admin, input)).rejects.toThrow(/ocupado/i);
  });
});
