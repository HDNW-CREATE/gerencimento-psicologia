import 'server-only';
import { getClinic, getScheduling } from '@/lib/settings';
import { maskPhone } from '@/lib/format';

/** Dados comuns às telas de sessão do paciente (endereço, contato e regras de prazo). */
export async function getPatientViewContext() {
  const [clinic, scheduling] = await Promise.all([getClinic(), getScheduling()]);
  const contact = clinic.whatsapp || clinic.phone;
  return {
    now: new Date(),
    minCancelHours: scheduling.minCancelHours,
    meetingMinutesBefore: scheduling.meetingLinkMinutesBefore,
    defaultMeetingUrl: scheduling.defaultMeetingUrl,
    address: [clinic.addressLine, clinic.city].filter(Boolean).join(', '),
    contactHint: contact
      ? `Entre em contato diretamente: ${maskPhone(contact)}.`
      : `Entre em contato pelo e-mail ${clinic.email}.`,
    manualApproval: scheduling.manualApproval,
  };
}
