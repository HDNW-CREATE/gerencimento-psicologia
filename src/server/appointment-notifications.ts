import 'server-only';
import { db } from '@/lib/db';
import { appUrl, env } from '@/lib/env';
import { fmtDate, fmtLongDate, fmtTime, formatBRL, modalityLabels } from '@/lib/format';
import { buildIcs } from '@/lib/ics';
import { getClinic, getScheduling } from '@/lib/settings';
import { sendTemplateEmail } from './notifications';

export type AppointmentMailKind =
  | 'requested' // paciente: pedido recebido (aprovação manual)
  | 'confirmed'
  | 'refused'
  | 'rescheduled'
  | 'cancelled'
  | 'reminder_24h'
  | 'reminder_2h';

const TEMPLATE_BY_KIND: Record<AppointmentMailKind, string> = {
  requested: 'appointment_requested',
  confirmed: 'appointment_confirmed',
  refused: 'appointment_refused',
  rescheduled: 'appointment_rescheduled',
  cancelled: 'appointment_cancelled',
  reminder_24h: 'reminder_24h',
  reminder_2h: 'reminder_2h',
};

async function loadAppointment(id: string) {
  return db.appointment.findUnique({
    where: { id },
    include: { patient: { include: { user: true } }, serviceType: true },
  });
}

/** Endereço do consultório em uma linha. */
function addressLine(c: Awaited<ReturnType<typeof getClinic>>) {
  return [c.addressLine, [c.city, c.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
}

/**
 * Envia o e-mail de um evento da sessão ao paciente.
 * Falhas de envio NUNCA derrubam a operação principal (ficam no NotificationLog).
 */
export async function notifyPatient(
  kind: AppointmentMailKind,
  appointmentId: string,
  opts: { reason?: string; dedupeKey?: string } = {},
) {
  try {
    const appt = await loadAppointment(appointmentId);
    if (!appt) return;
    const to = appt.patient.user?.email ?? appt.patient.email;
    if (!to) return; // paciente cadastrado sem e-mail

    const [clinic, scheduling] = await Promise.all([getClinic(), getScheduling()]);
    const isOnline = appt.modality === 'ONLINE';
    const isReminder = kind.startsWith('reminder');

    // O link só aparece nos lembretes (perto do horário); nas demais mensagens orientamos onde achá-lo.
    let local: string;
    let linkSessao = '';
    if (isOnline) {
      local =
        'Sessão online. O link ficará disponível na sua área do paciente poucos minutos antes do horário.';
      const url = appt.meetingUrl || scheduling.defaultMeetingUrl;
      if (isReminder && url) linkSessao = `Link da sessão online: ${url}`;
    } else {
      local = `Local: ${addressLine(clinic)}`;
    }

    const vars = {
      nome: appt.patient.socialName ?? appt.patient.fullName.split(' ')[0],
      data: fmtLongDate(appt.startsAt),
      hora: fmtTime(appt.startsAt),
      servico: appt.serviceType.name,
      modalidade: modalityLabels[appt.modality]!.toLowerCase(),
      local,
      link_sessao: linkSessao,
      link: `${appUrl()}/paciente`,
      motivo: opts.reason ?? '',
      valor: formatBRL(appt.priceCents),
    };

    const attachments =
      kind === 'confirmed' || kind === 'rescheduled' || kind === 'cancelled'
        ? [
            {
              filename: 'sessao.ics',
              contentType: 'text/calendar; method=REQUEST; charset=utf-8',
              content: buildIcs({
                uid: `sessao-${appt.id}@consultorio`,
                startsAt: appt.startsAt,
                endsAt: appt.endsAt,
                summary: `${appt.serviceType.name} – ${clinic.professionalName}`,
                description: isOnline
                  ? 'Sessão online. Acesse o link pela sua área do paciente.'
                  : undefined,
                location: isOnline ? 'Online' : addressLine(clinic),
                url: `${appUrl()}/paciente`,
                organizerName: clinic.professionalName,
                organizerEmail: clinic.email || undefined,
                sequence: Math.floor(appt.updatedAt.getTime() / 1000),
                method: kind === 'cancelled' ? 'CANCEL' : 'REQUEST',
              }),
            },
          ]
        : undefined;

    await sendTemplateEmail({
      templateKey: TEMPLATE_BY_KIND[kind],
      to,
      vars,
      userId: appt.patient.userId ?? undefined,
      appointmentId: appt.id,
      attachments,
      dedupeKey: opts.dedupeKey,
    });
  } catch (err) {
    console.error('[notify] falha ao notificar paciente:', (err as Error).message);
  }
}

/** Avisa a psicóloga (novo agendamento, cancelamento…). */
export async function notifyAdmin(appointmentId: string, summary: string) {
  try {
    const appt = await loadAppointment(appointmentId);
    if (!appt) return;
    const to =
      env().EMAIL_ADMIN_NOTIFY ||
      (await db.user.findFirst({ where: { role: 'ADMIN', deletedAt: null } }))?.email;
    if (!to) return;
    await sendTemplateEmail({
      templateKey: summary.startsWith('Novo') ? 'admin_new_appointment' : 'admin_cancelled',
      to,
      appointmentId,
      vars: {
        nome: appt.patient.socialName ?? appt.patient.fullName,
        data: fmtDate(appt.startsAt, 'EEEE, dd/MM'),
        hora: fmtTime(appt.startsAt),
        servico: appt.serviceType.name,
        modalidade: modalityLabels[appt.modality]!.toLowerCase(),
        motivo: summary,
        link: `${appUrl()}/admin/agenda`,
      },
    });
  } catch (err) {
    console.error('[notify] falha ao notificar admin:', (err as Error).message);
  }
}
