import { addHours } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { sendDueReminders } from '@/server/reminders';
import { baseFixtures, makeUser, resetDb } from './helpers';

describe('lembretes automáticos (integração)', () => {
  let service: Awaited<ReturnType<typeof baseFixtures>>['service'];
  beforeEach(async () => {
    await resetDb();
    ({ service } = await baseFixtures());
  });

  async function appt(
    patientId: string,
    startsAt: Date,
    status: 'AGENDADA' | 'CONFIRMADA' | 'CANCELADA_PACIENTE' = 'CONFIRMADA',
  ) {
    return db.appointment.create({
      data: {
        patientId,
        serviceTypeId: service.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 50 * 60_000),
        modality: 'ONLINE',
        status,
        meetingUrl: 'https://meet.example/abc',
      },
    });
  }

  it('envia o lembrete de 24h uma única vez, mesmo com execuções repetidas e simultâneas', async () => {
    const p = await makeUser('a@t.com');
    const a = await appt(p.patientProfile!.id, addHours(new Date(), 20));
    const runs = await Promise.all([sendDueReminders(), sendDueReminders(), sendDueReminders()]);
    await sendDueReminders();
    expect(
      await db.notificationLog.count({ where: { appointmentId: a.id, template: 'reminder_24h' } }),
    ).toBe(1);
    expect(runs.reduce((s, r) => s + r.sent24, 0)).toBeGreaterThanOrEqual(1);
    expect(
      (await db.appointment.findUnique({ where: { id: a.id } }))!.reminder24SentAt,
    ).not.toBeNull();
  });

  it('lembrete de 2h inclui o link; não envia para sessões canceladas nem fora da janela', async () => {
    const p = await makeUser('b@t.com');
    const soon = await appt(p.patientProfile!.id, addHours(new Date(), 1.5));
    const far = await appt(p.patientProfile!.id, addHours(new Date(), 100));
    const cancelled = await appt(
      p.patientProfile!.id,
      addHours(new Date(), 1.5 + 1),
      'CANCELADA_PACIENTE',
    );
    await sendDueReminders();
    expect(
      await db.notificationLog.count({
        where: { appointmentId: soon.id, template: 'reminder_2h' },
      }),
    ).toBe(1);
    expect(await db.notificationLog.count({ where: { appointmentId: far.id } })).toBe(0);
    expect(await db.notificationLog.count({ where: { appointmentId: cancelled.id } })).toBe(0);
  });

  it('respeita a preferência do paciente (notifyReminders = false)', async () => {
    const p = await makeUser('c@t.com');
    await db.user.update({ where: { id: p.id }, data: { notifyReminders: false } });
    const a = await appt(p.patientProfile!.id, addHours(new Date(), 20));
    await sendDueReminders();
    expect(await db.notificationLog.count({ where: { appointmentId: a.id } })).toBe(0);
  });

  it('não envia nada se os lembretes estiverem desativados', async () => {
    await db.setting.update({
      where: { key: 'scheduling' },
      data: { value: { remindersEnabled: false } },
    });
    const p = await makeUser('d@t.com');
    const a = await appt(p.patientProfile!.id, addHours(new Date(), 20));
    const r = await sendDueReminders();
    expect(r.sent24 + r.sent2).toBe(0);
    expect(await db.notificationLog.count({ where: { appointmentId: a.id } })).toBe(0);
  });
});
