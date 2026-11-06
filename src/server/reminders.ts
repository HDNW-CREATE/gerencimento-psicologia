import 'server-only';
import { addHours } from 'date-fns';
import { db } from '@/lib/db';
import { appUrl } from '@/lib/env';
import { fmtDate, formatBRL } from '@/lib/format';
import { purgeExpiredRateLimits } from '@/lib/ratelimit';
import { getScheduling } from '@/lib/settings';
import { notifyPatient } from './appointment-notifications';
import { sendTemplateEmail } from './notifications';

export interface ReminderReport {
  sent24: number;
  sent2: number;
  paymentNotices: number;
}

/**
 * Envia os lembretes devidos. Seguro para rodar a cada 15 min e de forma concorrente:
 *  • `reminderXSentAt` evita reenvio entre execuções;
 *  • `dedupeKey` único no NotificationLog evita envio duplo mesmo em execuções simultâneas.
 */
export async function sendDueReminders(now = new Date()): Promise<ReminderReport> {
  const scheduling = await getScheduling();
  const report: ReminderReport = { sent24: 0, sent2: 0, paymentNotices: 0 };
  if (!scheduling.remindersEnabled) return report;

  const base = {
    deletedAt: null,
    status: { in: ['AGENDADA', 'CONFIRMADA'] as ('AGENDADA' | 'CONFIRMADA')[] },
  };
  const include = { patient: { include: { user: { select: { notifyReminders: true } } } } };

  if (scheduling.reminder24h) {
    // Janela: faltam entre 6h e 24h. (Sessões marcadas "de última hora" não recebem um "lembrete de amanhã" sem sentido.)
    const due = await db.appointment.findMany({
      where: {
        ...base,
        reminder24SentAt: null,
        startsAt: { gt: addHours(now, 6), lte: addHours(now, 24) },
      },
      include,
      take: 200,
    });
    for (const a of due) {
      const wants = a.patient.user ? a.patient.user.notifyReminders : true;
      if (wants) {
        await notifyPatient('reminder_24h', a.id, {
          dedupeKey: `reminder24:${a.id}:${a.startsAt.getTime()}`,
        });
        report.sent24++;
      }
      await db.appointment.update({ where: { id: a.id }, data: { reminder24SentAt: now } });
    }
  }

  if (scheduling.reminder2h) {
    const due = await db.appointment.findMany({
      where: { ...base, reminder2SentAt: null, startsAt: { gt: now, lte: addHours(now, 2) } },
      include,
      take: 200,
    });
    for (const a of due) {
      const wants = a.patient.user ? a.patient.user.notifyReminders : true;
      if (wants) {
        await notifyPatient('reminder_2h', a.id, {
          dedupeKey: `reminder2:${a.id}:${a.startsAt.getTime()}`,
        });
        report.sent2++;
      }
      await db.appointment.update({ where: { id: a.id }, data: { reminder2SentAt: now } });
    }
  }

  return report;
}

/** Aviso (semanal) de pagamentos pendentes de sessões já realizadas. Opcional (configurável). */
export async function sendPaymentNotices(now = new Date()): Promise<number> {
  const scheduling = await getScheduling();
  if (!scheduling.paymentReminders) return 0;

  const weekKey = `${fmtDate(now, 'yyyy')}-W${fmtDate(now, 'II')}`;
  const pending = await db.payment.findMany({
    where: {
      status: 'PENDENTE',
      amountCents: { gt: 0 },
      appointment: {
        status: { in: ['REALIZADA', 'FALTA'] },
        deletedAt: null,
        startsAt: { lt: addHours(now, -48) },
      },
    },
    include: {
      patient: { include: { user: { select: { notifyPayments: true, email: true } } } },
      appointment: true,
    },
    take: 200,
  });

  // Agrupa por paciente: um e-mail por semana
  const byPatient = new Map<string, typeof pending>();
  for (const p of pending) byPatient.set(p.patientId, [...(byPatient.get(p.patientId) ?? []), p]);

  let sent = 0;
  for (const [patientId, items] of byPatient) {
    const patient = items[0]!.patient;
    const to = patient.user?.email ?? patient.email;
    if (!to || (patient.user && !patient.user.notifyPayments)) continue;
    const total = items.reduce((s, i) => s + i.amountCents, 0);
    const oldest = items
      .map((i) => i.appointment!.startsAt)
      .sort((a, b) => a.getTime() - b.getTime())[0]!;
    const r = await sendTemplateEmail({
      templateKey: 'payment_pending',
      to,
      userId: patient.userId ?? undefined,
      dedupeKey: `paynotice:${patientId}:${weekKey}`,
      vars: {
        nome: patient.socialName ?? patient.fullName.split(' ')[0],
        valor: formatBRL(total),
        data: fmtDate(oldest),
        link: `${appUrl()}/paciente/financeiro`,
      },
    });
    if (r.ok && r.providerId !== 'duplicado-ignorado') sent++;
  }
  return sent;
}

/** Limpeza periódica: tokens vencidos e janelas de rate limit antigas. */
export async function housekeeping(now = new Date()) {
  const cutoff = addHours(now, -24 * 7);
  await Promise.all([
    db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    db.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    purgeExpiredRateLimits(),
  ]);
}
