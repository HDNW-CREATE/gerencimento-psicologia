import 'server-only';
import type { PatientProfile } from '@prisma/client';
import { db } from '@/lib/db';
import { canShowMeetingLink, evaluateCancellation } from '@/lib/domain/policies';
import { addDaysYmd, utcToLocalYmd } from '@/lib/domain/time';
import { fmtDate, formatBRL, maskPhone, modalityLabels, whatsappLink } from '@/lib/format';
import { detectPatientIntent } from '@/lib/assistant/nlu';
import { ASSISTANT_NAME, type AssistantReply, type AssistantTurn } from '@/lib/assistant/types';
import { getClinic, getScheduling } from '@/lib/settings';
import { computeSlots } from '../availability';
import type { SessionUser } from '../session';

const one = (text: string, extra: Partial<AssistantReply> = {}): AssistantTurn => ({
  replies: [{ text, ...extra }],
  state: null,
});

const MENU_QUICK = [
  'Minha próxima sessão',
  'Horários disponíveis',
  'Pagamentos',
  'Preciso remarcar',
];

/**
 * Assistente do PACIENTE. Todas as consultas são filtradas pelo paciente da SESSÃO
 * (nunca por nome/ID digitado) e nunca tocam o prontuário.
 */
export async function handlePatientMessage(
  user: SessionUser & { patientProfile: PatientProfile },
  text: string,
): Promise<AssistantTurn> {
  const intent = detectPatientIntent(text);
  const patientId = user.patientProfile.id;
  const first = (user.patientProfile.socialName ?? user.patientProfile.fullName).split(' ')[0];
  const now = new Date();

  const clinic = await getClinic();
  const contactLinks = [
    ...(clinic.whatsapp
      ? [
          {
            label: 'Falar no WhatsApp',
            href: whatsappLink(clinic.whatsapp, 'Olá! Preciso de ajuda com o meu atendimento.'),
          },
        ]
      : []),
  ];

  switch (intent) {
    case 'crisis':
      // Prioridade máxima: acolhimento + canais de ajuda imediata.
      return one(
        `Sinto muito que você esteja passando por isso, e fico feliz que tenha escrito. **Você não precisa enfrentar isso sozinho(a).**\n\n` +
          `Se estiver em perigo agora ou pensando em se machucar:\n• **CVV – 188** (24 horas, gratuito, também por chat em cvv.org.br)\n• **SAMU – 192** ou **Bombeiros – 193**\n• Vá ao pronto-socorro mais próximo ou peça para alguém de confiança ficar com você.\n\n` +
          `Também avise a sua psicóloga o quanto antes${clinic.whatsapp ? ` — ela está no WhatsApp ${maskPhone(clinic.whatsapp)}` : ''}. Este chat é um assistente automático e **não substitui atendimento de emergência**.`,
        { links: contactLinks },
      );

    case 'next_session': {
      const a = await db.appointment.findFirst({
        where: {
          patientId,
          deletedAt: null,
          status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
          endsAt: { gt: now },
        },
        include: { serviceType: true },
        orderBy: { startsAt: 'asc' },
      });
      if (!a)
        return one('Você ainda não tem uma sessão agendada. Quer ver os horários disponíveis?', {
          quick: ['Horários disponíveis'],
          links: [{ label: 'Agendar sessão', href: '/paciente/agendar' }],
        });
      const sched = await getScheduling();
      const showLink =
        a.modality === 'ONLINE' &&
        canShowMeetingLink(a.startsAt, a.endsAt, now, sched.meetingLinkMinutesBefore);
      return one(
        `Sua próxima sessão é **${fmtDate(a.startsAt, "EEEE, dd/MM 'às' HH:mm")}** — ${a.serviceType.name} (${modalityLabels[a.modality].toLowerCase()}).${a.status === 'PENDENTE' ? '\nEla está **aguardando confirmação** da psicóloga.' : ''}${a.modality === 'ONLINE' ? (showLink ? '\nO botão para **entrar na sessão** já está disponível na sua área.' : `\nO botão para entrar aparece na sua área ${sched.meetingLinkMinutesBefore} min antes.`) : ''}`,
        {
          links: [{ label: 'Abrir minhas sessões', href: '/paciente/sessoes' }],
          quick: ['Preciso remarcar'],
        },
      );
    }

    case 'availability': {
      const service = await db.serviceType.findFirst({
        where: { active: true, deletedAt: null, isCouple: false },
        orderBy: { sortOrder: 'asc' },
      });
      if (!service) return one('No momento não há serviços abertos para agendamento.');
      const from = utcToLocalYmd(now);
      const [pres, onl] = await Promise.all(
        (['PRESENCIAL', 'ONLINE'] as const).map((m) =>
          (m === 'PRESENCIAL' && !service.allowsInPerson) ||
          (m === 'ONLINE' && !service.allowsOnline)
            ? Promise.resolve([])
            : computeSlots({
                durationMinutes: service.durationMinutes,
                modality: m,
                fromYmd: from,
                toYmd: addDaysYmd(from, 21),
              }),
        ),
      );
      const merged = new Map<number, Set<string>>();
      for (const [list, label] of [
        [pres, 'presencial'],
        [onl, 'online'],
      ] as const)
        for (const s of list)
          merged.set(
            s.startsAt.getTime(),
            (merged.get(s.startsAt.getTime()) ?? new Set()).add(label),
          );
      const next = [...merged.entries()].sort((a, b) => a[0] - b[0]).slice(0, 6);
      if (next.length === 0)
        return one(
          'Não encontrei horários livres nas próximas semanas. Fale com o consultório para ver outras opções.',
          { links: contactLinks },
        );
      return one(
        `Próximos horários livres (${service.name}):\n${next.map(([ts, ms]) => `• ${fmtDate(new Date(ts), "EEE dd/MM 'às' HH:mm")} — ${[...ms].join(' / ')}`).join('\n')}\n\nPara reservar, use o botão abaixo.`,
        { links: [{ label: 'Agendar sessão', href: '/paciente/agendar' }] },
      );
    }

    case 'book':
      return one(
        'Você agenda em poucos passos: escolhe o serviço, a modalidade e um horário livre. Precisa estar com o **e-mail confirmado**.',
        {
          links: [{ label: 'Agendar sessão', href: '/paciente/agendar' }],
          quick: ['Horários disponíveis'],
        },
      );

    case 'reschedule':
    case 'cancel': {
      const sched = await getScheduling();
      const a = await db.appointment.findFirst({
        where: {
          patientId,
          deletedAt: null,
          status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
          startsAt: { gt: now },
        },
        orderBy: { startsAt: 'asc' },
      });
      const verb = intent === 'cancel' ? 'cancelar' : 'remarcar';
      if (!a)
        return one('Você não tem sessões futuras para alterar.', {
          links: [{ label: 'Agendar sessão', href: '/paciente/agendar' }],
        });
      const d = evaluateCancellation(a.startsAt, now, sched.minCancelHours);
      if (d.allowed) {
        return one(
          `Você pode **${verb}** a sessão de **${fmtDate(a.startsAt, "EEEE, dd/MM 'às' HH:mm")}** pelo sistema, até ${sched.minCancelHours}h antes. É só abrir “Minhas sessões” e usar o botão.`,
          { links: [{ label: 'Abrir minhas sessões', href: '/paciente/sessoes' }] },
        );
      }
      return one(
        `A sessão de **${fmtDate(a.startsAt, "EEEE, dd/MM 'às' HH:mm")}** está dentro do prazo mínimo de ${sched.minCancelHours}h, então não dá para ${verb} pelo sistema. **Fale diretamente com o consultório** para combinar.`,
        { links: contactLinks },
      );
    }

    case 'payments': {
      const [pend, paid] = await Promise.all([
        db.payment.findMany({
          where: { patientId, status: 'PENDENTE', amountCents: { gt: 0 } },
          include: { appointment: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        db.payment.count({ where: { patientId, status: 'PAGO' } }),
      ]);
      if (pend.length === 0)
        return one(`Você não tem pagamentos pendentes. 🎉 (${paid} pagamento(s) já registrados.)`, {
          links: [{ label: 'Abrir financeiro', href: '/paciente/financeiro' }],
        });
      const total = pend.reduce((s, p) => s + p.amountCents, 0);
      return one(
        `Você tem **${formatBRL(total)}** pendente:\n${pend.map((p) => `• ${p.appointment ? fmtDate(p.appointment.startsAt) : 'Avulso'} — ${formatBRL(p.amountCents)}`).join('\n')}\n\nSe já pagou, a psicóloga dará baixa no sistema.`,
        { links: [{ label: 'Abrir financeiro', href: '/paciente/financeiro' }] },
      );
    }

    case 'receipt': {
      const paid = await db.payment.count({ where: { patientId, status: 'PAGO' } });
      return one(
        paid
          ? `Você tem **${paid} recibo(s)** disponível(is). Baixe em PDF no seu financeiro — servem para reembolso e Imposto de Renda.`
          : 'Os recibos ficam disponíveis depois que o pagamento é registrado como **pago**.',
        { links: [{ label: 'Abrir financeiro', href: '/paciente/financeiro' }] },
      );
    }

    case 'price': {
      const sched = await getScheduling();
      if (!sched.showPricesOnSite)
        return one(
          'Os valores são combinados diretamente com a psicóloga. Entre em contato para saber mais.',
          { links: contactLinks },
        );
      const services = await db.serviceType.findMany({
        where: { active: true, deletedAt: null, showPrice: true, priceCents: { gt: 0 } },
        orderBy: { sortOrder: 'asc' },
      });
      if (services.length === 0)
        return one('Os valores são combinados diretamente com a psicóloga.', {
          links: contactLinks,
        });
      const mine = user.patientProfile.customPriceCents;
      return one(
        `**Valores por sessão:**\n${services.map((s) => `• ${s.name} (${s.durationMinutes} min) — ${formatBRL(s.priceCents)}`).join('\n')}${mine != null ? `\n\nO seu valor combinado é **${formatBRL(mine)}**.` : ''}`,
      );
    }

    case 'documents': {
      const n = await db.document.count({
        where: { patientId, sharedWithPatient: true, deletedAt: null },
      });
      return one(
        n
          ? `Você tem **${n} documento(s)** compartilhado(s) pela psicóloga.`
          : 'Ainda não há documentos compartilhados com você. Precisa de um atestado ou declaração? Peça diretamente à psicóloga.',
        { links: [{ label: 'Abrir documentos', href: '/paciente/documentos' }, ...contactLinks] },
      );
    }

    case 'contact': {
      const addr = [clinic.addressLine, [clinic.city, clinic.state].filter(Boolean).join(' - ')]
        .filter(Boolean)
        .join(', ');
      const links = [
        ...contactLinks,
        ...(addr
          ? [
              {
                label: 'Ver no mapa',
                href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,
              },
            ]
          : []),
      ];
      return one(
        `**Contato do consultório**\n${addr ? `📍 ${addr}\n` : ''}${clinic.phone ? `📞 ${maskPhone(clinic.phone)}\n` : ''}${clinic.whatsapp ? `💬 WhatsApp ${maskPhone(clinic.whatsapp)}\n` : ''}${clinic.email ? `✉️ ${clinic.email}` : ''}`.trim(),
        { links },
      );
    }

    case 'online_link':
      return one(
        'Nas sessões online, o botão **“Entrar na sessão online”** aparece na sua área alguns minutos antes do horário e fica disponível até o fim da sessão. Você também recebe o link no lembrete por e-mail.',
        { links: [{ label: 'Abrir minha área', href: '/paciente' }] },
      );

    case 'privacy':
      return one(
        'Seus dados são protegidos pela LGPD e o conteúdo clínico é criptografado. Em **Privacidade** você pode pedir uma cópia dos seus dados ou solicitar a exclusão da conta (o prontuário precisa ser guardado por, no mínimo, 5 anos, por norma do CFP).',
        { links: [{ label: 'Privacidade e meus dados', href: '/paciente/privacidade' }] },
      );

    case 'account':
      return one(
        'Você pode atualizar telefone e contatos, trocar a senha e escolher quais e-mails receber no seu **perfil**. Se esqueceu a senha, use “Esqueci minha senha” na tela de login.',
        { links: [{ label: 'Abrir meu perfil', href: '/paciente/perfil' }] },
      );

    case 'greeting':
      return one(
        `Olá, ${first}! Eu sou a **${ASSISTANT_NAME}**, assistente do consultório. 🌿\nPosso ajudar com suas sessões, horários, pagamentos e informações. Como posso ajudar?`,
        { quick: MENU_QUICK },
      );

    case 'thanks':
      return one('Por nada! Estou por aqui se precisar. 💚');

    case 'help':
      return one(
        `Posso ajudar com:\n• Sua **próxima sessão** e o link da sessão online\n• **Horários disponíveis** e como agendar\n• **Remarcar ou cancelar** (e o prazo)\n• **Pagamentos** e recibos\n• Documentos, valores, endereço e contato\n\nNão tenho acesso ao seu prontuário e não substituo a conversa com a psicóloga.`,
        { quick: MENU_QUICK },
      );

    default:
      return one(
        'Não tenho certeza de ter entendido. 🤔 Posso ajudar com sessões, horários, pagamentos e contato. Se preferir, fale direto com o consultório.',
        { quick: MENU_QUICK, links: contactLinks },
      );
  }
}
