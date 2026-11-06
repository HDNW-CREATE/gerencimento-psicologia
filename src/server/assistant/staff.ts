import 'server-only';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { OCCUPYING_STATUSES } from '@/lib/domain/policies';
import { addDaysYmd, endOfLocalDayUtc, startOfLocalDayUtc, utcToLocalYmd } from '@/lib/domain/time';
import { fmtDate, fmtTime, formatBRL, maskPhone, modalityLabels, statusLabels } from '@/lib/format';
import { can } from '@/lib/permissions';
import { isMinor } from '@/lib/validators';
import {
  cleanName,
  detectStaffIntent,
  extractSearchTerm,
  isCancel,
  isFix,
  isNo,
  isSkip,
  isYes,
  parseBirth,
  parseEmail,
  parsePatientDetails,
  parsePhone,
  type StaffIntent,
} from '@/lib/assistant/nlu';
import type {
  AssistantReply,
  AssistantState,
  AssistantTurn,
  RegisterData,
  RegisterStep,
} from '@/lib/assistant/types';
import { ASSISTANT_NAME } from '@/lib/assistant/types';
import { UserError } from '../action-result';
import { loadDashboard } from '../dashboard';
import { createPatientRecord } from '../patients';
import type { SessionUser } from '../session';

type Reply = AssistantReply;
const turn = (
  replies: Reply[],
  state: AssistantState = null,
  saved = false,
): AssistantTurn & { saved?: boolean } => ({ replies, state, saved });
const one = (text: string, extra: Partial<Reply> = {}, state: AssistantState = null) =>
  turn([{ text, ...extra }], state);

const MENU_QUICK = [
  'Quem eu vou atender hoje?',
  'Cadastrar paciente',
  'Pagamentos pendentes',
  'Resumo do mês',
];

/* ───────────────────────── Agenda ───────────────────────── */

async function sessionsOn(offsetDays: number, spanDays = 1) {
  const from = addDaysYmd(utcToLocalYmd(new Date()), offsetDays);
  return db.appointment.findMany({
    where: {
      deletedAt: null,
      status: { in: [...OCCUPYING_STATUSES] },
      startsAt: {
        gte: startOfLocalDayUtc(from),
        lt: endOfLocalDayUtc(addDaysYmd(from, spanDays - 1)),
      },
    },
    include: {
      patient: { select: { fullName: true, socialName: true } },
      serviceType: { select: { name: true } },
    },
    orderBy: { startsAt: 'asc' },
  });
}

const line = (a: Awaited<ReturnType<typeof sessionsOn>>[number]) =>
  `• **${fmtTime(a.startsAt)}** — ${a.patient.socialName ?? a.patient.fullName} · ${modalityLabels[a.modality]} · ${statusLabels[a.status]}`;

async function agendaDay(offset: 0 | 1): Promise<AssistantTurn> {
  const list = await sessionsOn(offset);
  const label = offset === 0 ? 'hoje' : 'amanhã';
  const when = fmtDate(addDaysToNow(offset), 'EEEE, dd/MM');
  if (list.length === 0) {
    return one(`Você não tem sessões ${label} (${when}). 🌿`, {
      links: [{ label: 'Abrir agenda', href: '/admin/agenda' }],
      quick: offset === 0 ? ['E amanhã?', 'Esta semana'] : ['Esta semana', 'Cadastrar paciente'],
    });
  }
  const pending = list.filter((a) => a.status === 'PENDENTE').length;
  return one(
    `**${label[0]!.toUpperCase()}${label.slice(1)} (${when})** — ${list.length} sessão(ões):\n${list.map(line).join('\n')}${pending ? `\n\n⚠️ ${pending} aguardando a sua aprovação.` : ''}`,
    {
      links: [{ label: 'Abrir agenda', href: '/admin/agenda' }],
      quick:
        offset === 0
          ? ['E amanhã?', 'Esta semana', 'Pagamentos pendentes']
          : ['Esta semana', 'Hoje'],
    },
  );
}

function addDaysToNow(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

async function agendaWeek(): Promise<AssistantTurn> {
  const list = await sessionsOn(0, 7);
  if (list.length === 0)
    return one('Não há sessões marcadas nos próximos 7 dias.', {
      links: [{ label: 'Abrir agenda', href: '/admin/agenda' }],
    });
  const byDay = new Map<string, typeof list>();
  for (const a of list)
    byDay.set(utcToLocalYmd(a.startsAt), [...(byDay.get(utcToLocalYmd(a.startsAt)) ?? []), a]);
  const text = [...byDay.entries()]
    .map(
      ([_ymd, items]) =>
        `**${fmtDate(items[0]!.startsAt, 'EEEE, dd/MM')}** (${items.length})\n${items.map(line).join('\n')}`,
    )
    .join('\n\n');
  return one(`Próximos 7 dias — ${list.length} sessão(ões):\n\n${text}`, {
    links: [{ label: 'Abrir agenda', href: '/admin/agenda' }],
  });
}

async function nextSession(): Promise<AssistantTurn> {
  const a = await db.appointment.findFirst({
    where: {
      deletedAt: null,
      status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
      startsAt: { gt: new Date() },
    },
    include: {
      patient: { select: { id: true, fullName: true, socialName: true } },
      serviceType: { select: { name: true } },
    },
    orderBy: { startsAt: 'asc' },
  });
  if (!a) return one('Não há próximas sessões marcadas.');
  return one(
    `Sua próxima sessão é **${fmtDate(a.startsAt, "EEEE, dd/MM 'às' HH:mm")}** com **${a.patient.socialName ?? a.patient.fullName}** (${a.serviceType.name}, ${modalityLabels[a.modality].toLowerCase()}).`,
    {
      links: [{ label: 'Ficha do paciente', href: `/admin/pacientes/${a.patient.id}` }],
    },
  );
}

async function approvals(): Promise<AssistantTurn> {
  const list = await db.appointment.findMany({
    where: { deletedAt: null, status: 'PENDENTE', startsAt: { gt: new Date() } },
    include: { patient: { select: { fullName: true, socialName: true } } },
    orderBy: { startsAt: 'asc' },
    take: 10,
  });
  if (list.length === 0) return one('Nenhum agendamento aguardando aprovação. ✅');
  return one(
    `**${list.length} pedido(s) aguardando aprovação:**\n${list.map((a) => `• ${a.patient.socialName ?? a.patient.fullName} — ${fmtDate(a.startsAt, "EEE dd/MM 'às' HH:mm")}`).join('\n')}`,
    {
      links: [{ label: 'Aprovar na agenda', href: '/admin/agenda' }],
    },
  );
}

/* ───────────────────────── Financeiro e resumo ───────────────────────── */

async function pendingPayments(actor: SessionUser): Promise<AssistantTurn> {
  if (!can(actor.role, 'finance.manage')) return one('Sua conta não tem acesso ao financeiro.');
  const rows = await db.payment.findMany({
    where: {
      status: 'PENDENTE',
      amountCents: { gt: 0 },
      appointment: {
        status: { in: ['REALIZADA', 'FALTA'] },
        deletedAt: null,
        startsAt: { lt: new Date() },
      },
    },
    include: { patient: { select: { id: true, fullName: true, socialName: true } } },
  });
  if (rows.length === 0)
    return one('Não há pagamentos pendentes de sessões já realizadas. ✅', {
      links: [{ label: 'Abrir financeiro', href: '/admin/financeiro' }],
    });
  const by = new Map<string, { name: string; id: string; total: number; n: number }>();
  for (const r of rows) {
    const cur = by.get(r.patientId) ?? {
      name: r.patient.socialName ?? r.patient.fullName,
      id: r.patient.id,
      total: 0,
      n: 0,
    };
    cur.total += r.amountCents;
    cur.n += 1;
    by.set(r.patientId, cur);
  }
  const sorted = [...by.values()].sort((a, b) => b.total - a.total);
  const total = sorted.reduce((s, x) => s + x.total, 0);
  return one(
    `**${formatBRL(total)} pendente** em ${sorted.length} paciente(s):\n${sorted
      .slice(0, 8)
      .map((x) => `• ${x.name} — ${formatBRL(x.total)} (${x.n} sessão/sessões)`)
      .join('\n')}${sorted.length > 8 ? `\n… e mais ${sorted.length - 8}.` : ''}`,
    { links: [{ label: 'Abrir financeiro', href: '/admin/financeiro?status=PENDENTE' }] },
  );
}

async function monthSummary(actor: SessionUser): Promise<AssistantTurn> {
  if (!can(actor.role, 'finance.manage'))
    return one('Sua conta não tem acesso ao resumo financeiro.');
  const d = await loadDashboard();
  const m = d.month;
  return one(
    `**Resumo do mês**\n• Sessões realizadas: **${m.realizadas}**\n• Faltas: ${m.faltas} · Cancelamentos: ${m.canceladas}\n• Novos pacientes: ${m.novos}\n• Recebido: **${formatBRL(m.receivedCents)}**\n• A receber: ${formatBRL(m.toReceiveCents)}`,
    { links: [{ label: 'Ver painel completo', href: '/admin' }] },
  );
}

/* ───────────────────────── Busca de paciente ───────────────────────── */

async function searchPatient(actor: SessionUser, text: string): Promise<AssistantTurn> {
  if (!can(actor.role, 'patients.read'))
    return one('Sua conta não tem acesso à lista de pacientes.');
  const term = extractSearchTerm(text);
  if (!term) return one('Quem você quer buscar? Diga, por exemplo: **buscar Maria Souza**.');
  const found = await db.patientProfile.findMany({
    where: {
      deletedAt: null,
      OR: [
        { fullName: { contains: term, mode: 'insensitive' } },
        { socialName: { contains: term, mode: 'insensitive' } },
      ],
    },
    take: 6,
    orderBy: { fullName: 'asc' },
  });
  if (found.length === 0)
    return one(`Não encontrei ninguém com “${term}”. Quer cadastrar?`, {
      quick: ['Cadastrar paciente'],
    });
  if (found.length > 1) {
    return one(
      `Encontrei ${found.length} pacientes com “${term}”:\n${found.map((p) => `• ${p.socialName ?? p.fullName}`).join('\n')}\n\nSeja mais específica ou abra a lista.`,
      {
        links: [
          {
            label: 'Abrir lista de pacientes',
            href: `/admin/pacientes?q=${encodeURIComponent(term)}`,
          },
        ],
      },
    );
  }
  const p = found[0]!;
  const [next, pending] = await Promise.all([
    db.appointment.findFirst({
      where: {
        patientId: p.id,
        deletedAt: null,
        status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
        startsAt: { gt: new Date() },
      },
      orderBy: { startsAt: 'asc' },
    }),
    can(actor.role, 'finance.manage')
      ? db.payment.aggregate({
          where: { patientId: p.id, status: 'PENDENTE', amountCents: { gt: 0 } },
          _sum: { amountCents: true },
        })
      : null,
  ]);
  const lines = [
    `**${p.socialName ?? p.fullName}** (${p.status.toLowerCase()})`,
    p.phone ? `📞 ${maskPhone(p.phone)}` : null,
    p.email ? `✉️ ${p.email}` : null,
    next
      ? `Próxima sessão: ${fmtDate(next.startsAt, "dd/MM 'às' HH:mm")}`
      : 'Sem sessão futura marcada.',
    pending?._sum.amountCents ? `Pendente: ${formatBRL(pending._sum.amountCents)}` : null,
  ].filter(Boolean);
  return one(lines.join('\n'), {
    links: [{ label: 'Abrir ficha', href: `/admin/pacientes/${p.id}` }],
  });
}

/* ───────────────────────── Cadastro guiado de paciente ───────────────────────── */

const needsGuardian = (d: RegisterData) => !!d.birthDate && isMinor(d.birthDate);

function nextStep(d: RegisterData): RegisterStep {
  if (d.fullName === undefined || d.fullName === null) return 'name';
  if (d.phone === undefined) return 'phone';
  if (d.email === undefined) return 'email';
  if (d.birthDate === undefined) return 'birth';
  if (needsGuardian(d) && d.guardianName === undefined) return 'guardianName';
  if (needsGuardian(d) && d.guardianPhone === undefined) return 'guardianPhone';
  return 'confirm';
}

function summary(d: RegisterData): string {
  return [
    `• Nome: **${d.fullName}**`,
    `• Telefone: ${d.phone ? maskPhone(d.phone) : '—'}`,
    `• E-mail: ${d.email ?? '—'}`,
    `• Nascimento: ${d.birthDate ? d.birthDate.split('-').reverse().join('/') : '—'}`,
    ...(needsGuardian(d)
      ? [
          `• Responsável: ${d.guardianName ?? '—'}${d.guardianPhone ? ` (${maskPhone(d.guardianPhone)})` : ''}`,
        ]
      : []),
    ...(d.cpf ? ['• CPF: informado'] : []),
  ].join('\n');
}

function promptFor(step: RegisterStep, d: RegisterData): Reply {
  switch (step) {
    case 'name':
      return { text: 'Claro! Qual é o **nome completo** do paciente?', quick: ['Cancelar'] };
    case 'phone':
      return {
        text: `Certo, **${d.fullName}**. Qual o **telefone/WhatsApp** (com DDD)?\nSe não tiver, diga **pular**.`,
        quick: ['Pular', 'Cancelar'],
      };
    case 'email':
      return {
        text: 'E o **e-mail**? (ele permite que o paciente crie a conta depois)',
        quick: ['Pular', 'Cancelar'],
      };
    case 'birth':
      return { text: 'Qual a **data de nascimento**? (dd/mm/aaaa)', quick: ['Pular', 'Cancelar'] };
    case 'guardianName':
      return {
        text: 'O paciente é **menor de idade**. Qual o **nome do responsável legal**?',
        quick: ['Cancelar'],
      };
    case 'guardianPhone':
      return {
        text: `Qual o telefone de **${d.guardianName}** (responsável)?`,
        quick: ['Pular', 'Cancelar'],
      };
    case 'confirm':
      return {
        text: `Confira os dados:\n${summary(d)}\n\nPosso **salvar** este cadastro?`,
        quick: ['Confirmar', 'Corrigir', 'Cancelar'],
      };
    case 'duplicate':
      return { text: '', quick: [] };
  }
}

async function startRegister(actor: SessionUser, text: string): Promise<AssistantTurn> {
  if (!can(actor.role, 'patients.write'))
    return one('Sua conta não tem permissão para cadastrar pacientes.');
  const data = parsePatientDetails(text);
  const step = nextStep(data);
  const prefilled = Object.keys(data).length > 0;
  const prompt = promptFor(step, data);
  return turn(
    [
      {
        ...prompt,
        text:
          prefilled && step !== 'name'
            ? `Entendi! Anotei o que você disse.\n${prompt.text}`
            : prompt.text,
        quick: prompt.quick,
      },
    ],
    { flow: 'register', step, data },
  );
}

async function findDuplicates(d: RegisterData) {
  const or = [
    ...(d.fullName ? [{ fullName: { equals: d.fullName, mode: 'insensitive' as const } }] : []),
    ...(d.email ? [{ email: d.email }] : []),
    ...(d.phone ? [{ phone: d.phone }] : []),
  ];
  if (or.length === 0) return [];
  return db.patientProfile.findMany({
    where: { deletedAt: null, OR: or },
    take: 3,
    select: { id: true, fullName: true, phone: true },
  });
}

async function saveRegister(actor: SessionUser, d: RegisterData): Promise<AssistantTurn> {
  try {
    const p = await createPatientRecord(
      actor,
      {
        fullName: d.fullName ?? '',
        phone: d.phone ?? undefined,
        email: d.email ?? undefined,
        birthDate: d.birthDate ?? undefined,
        cpf: d.cpf ?? undefined,
        guardianName: d.guardianName ?? undefined,
        guardianPhone: d.guardianPhone ?? undefined,
        status: 'ATIVO',
      },
      'assistant',
    );
    return turn(
      [
        {
          text: `✅ Pronto! **${p.fullName}** foi cadastrado(a) e já está no sistema.`,
          links: [
            { label: 'Abrir ficha', href: `/admin/pacientes/${p.id}` },
            { label: 'Agendar na agenda', href: '/admin/agenda' },
          ],
          quick: ['Cadastrar outro paciente', 'Quem eu vou atender hoje?'],
        },
      ],
      null,
      true,
    );
  } catch (err) {
    const msg =
      err instanceof UserError
        ? err.message
        : err instanceof ZodError
          ? err.issues[0]?.message
          : null;
    if (msg)
      return one(`Não consegui salvar: ${msg}\nNenhum dado foi gravado. Quer tentar de novo?`, {
        quick: ['Cadastrar paciente'],
      });
    throw err;
  }
}

async function continueRegister(
  actor: SessionUser,
  state: NonNullable<AssistantState>,
  text: string,
): Promise<AssistantTurn> {
  const data: RegisterData = { ...state.data };
  const again = (msg: string) =>
    turn([{ text: msg, quick: ['Pular', 'Cancelar'] }], {
      flow: 'register',
      step: state.step,
      data,
    });
  const goNext = (): AssistantTurn | Promise<AssistantTurn> => {
    const step = nextStep(data);
    return turn([promptFor(step, data)], { flow: 'register', step, data });
  };

  switch (state.step) {
    case 'name': {
      const parsed = parsePatientDetails(`cadastrar ${text}`);
      const name = parsed.fullName ?? cleanName(text);
      if (!name)
        return turn(
          [
            {
              text: 'Não consegui entender o nome. Escreva o **nome completo** (só letras), por favor.',
              quick: ['Cancelar'],
            },
          ],
          state,
        );
      data.fullName = name;
      for (const k of ['phone', 'email', 'birthDate', 'cpf'] as const)
        if (parsed[k]) data[k] = parsed[k];
      return goNext();
    }
    case 'phone': {
      if (isSkip(text)) data.phone = null;
      else {
        const p = parsePhone(text);
        if (!p)
          return again(
            'Não entendi o telefone. Use DDD + número, ex.: **(11) 98888-7777**, ou diga **pular**.',
          );
        data.phone = p;
      }
      return goNext();
    }
    case 'email': {
      if (isSkip(text)) data.email = null;
      else {
        const e = parseEmail(text);
        if (!e)
          return again('Não entendi o e-mail. Exemplo: **nome@exemplo.com** — ou diga **pular**.');
        data.email = e;
      }
      return goNext();
    }
    case 'birth': {
      if (isSkip(text)) data.birthDate = null;
      else {
        const b = parseBirth(text);
        if (b === null)
          return again(
            'Não entendi a data. Use **dd/mm/aaaa**, ex.: 12/03/1990 — ou diga **pular**.',
          );
        if (b === 'invalid')
          return again('Essa data não parece válida. Confira o dia, o mês e o ano (dd/mm/aaaa).');
        data.birthDate = b;
      }
      return goNext();
    }
    case 'guardianName': {
      const n = cleanName(text);
      if (!n)
        return turn(
          [
            {
              text: 'Não entendi o nome do responsável. Escreva o nome completo, por favor.',
              quick: ['Cancelar'],
            },
          ],
          state,
        );
      data.guardianName = n;
      return goNext();
    }
    case 'guardianPhone': {
      if (isSkip(text)) data.guardianPhone = null;
      else {
        const p = parsePhone(text);
        if (!p)
          return again(
            'Não entendi o telefone do responsável. Use DDD + número, ou diga **pular**.',
          );
        data.guardianPhone = p;
      }
      return goNext();
    }
    case 'confirm': {
      if (isFix(text))
        return turn(
          [
            {
              text: 'Sem problema, vamos refazer. Qual é o **nome completo** do paciente?',
              quick: ['Cancelar'],
            },
          ],
          { flow: 'register', step: 'name', data: {} },
        );
      if (isYes(text)) {
        const dups = await findDuplicates(data);
        if (dups.length > 0) {
          return turn(
            [
              {
                text: `⚠️ Já existe cadastro parecido:\n${dups.map((x) => `• ${x.fullName}${x.phone ? ` (${maskPhone(x.phone)})` : ''}`).join('\n')}\n\nQuer cadastrar **mesmo assim**?`,
                links: dups.map((x) => ({
                  label: `Abrir ${x.fullName.split(' ')[0]}`,
                  href: `/admin/pacientes/${x.id}`,
                })),
                quick: ['Sim, cadastrar mesmo assim', 'Cancelar'],
              },
            ],
            { flow: 'register', step: 'duplicate', data },
          );
        }
        return saveRegister(actor, data);
      }
      if (isNo(text))
        return turn(
          [
            {
              text: 'Quer **corrigir** os dados ou **cancelar** o cadastro?',
              quick: ['Corrigir', 'Cancelar'],
            },
          ],
          state,
        );
      return turn([promptFor('confirm', data)], state);
    }
    case 'duplicate': {
      if (isYes(text)) return saveRegister(actor, data);
      return one('Certo, não cadastrei. Nada foi salvo.');
    }
  }
}

/* ───────────────────────── Entrada ───────────────────────── */

const INTERRUPTS: StaffIntent[] = [
  'today',
  'tomorrow',
  'week',
  'next',
  'payments',
  'summary',
  'approvals',
  'help',
];

export async function handleStaffMessage(
  actor: SessionUser,
  text: string,
  state: AssistantState,
): Promise<AssistantTurn & { saved?: boolean }> {
  const intent = detectStaffIntent(text);

  if (state?.flow === 'register') {
    if (isCancel(text))
      return one('Tudo bem, cancelei o cadastro. **Nada foi salvo.**', { quick: MENU_QUICK });
    // Pergunta de outro assunto no meio do cadastro: encerra o cadastro e responde.
    if (INTERRUPTS.includes(intent) && state.step !== 'confirm' && state.step !== 'duplicate') {
      const rest = await handleStaffMessage(actor, text, null);
      return {
        ...rest,
        replies: [
          { text: '(Cancelei o cadastro em andamento — nada foi salvo.)' },
          ...rest.replies,
        ],
      };
    }
    return continueRegister(actor, state, text);
  }

  const first = actor.name.split(' ')[0];
  switch (intent) {
    case 'register':
      return startRegister(actor, text);
    case 'today':
      return agendaDay(0);
    case 'tomorrow':
      return agendaDay(1);
    case 'week':
      return agendaWeek();
    case 'next':
      return nextSession();
    case 'approvals':
      return approvals();
    case 'payments':
      return pendingPayments(actor);
    case 'summary':
      return monthSummary(actor);
    case 'search':
      return searchPatient(actor, text);
    case 'clinical':
      return one(
        'Por segurança, **não mostro conteúdo de prontuário no chat** — ele é criptografado e cada acesso é registrado. Abra a ficha do paciente para consultar.',
        {
          links: [{ label: 'Abrir pacientes', href: '/admin/pacientes' }],
        },
      );
    case 'greeting':
      return one(
        `Olá, ${first}! Eu sou a **${ASSISTANT_NAME}**, sua assistente do consultório. 🌿\nPosso consultar a agenda, buscar pacientes, ver pendências e **cadastrar pacientes** por aqui. O que você precisa?`,
        { quick: MENU_QUICK },
      );
    case 'thanks':
      return one('Por nada! Estou por aqui se precisar. 💚');
    case 'help':
      return one(
        `Posso ajudar com:\n• **Agenda:** “quem eu vou atender hoje?”, “e amanhã?”, “esta semana”, “próxima sessão”\n• **Pacientes:** “cadastrar paciente Maria Souza, telefone (11) 98888-7777” ou só “cadastrar paciente”; “buscar Ana”\n• **Pendências:** “pagamentos pendentes”, “pedidos aguardando aprovação”\n• **Resumo:** “resumo do mês”\n\nNão mostro conteúdo de prontuário no chat.`,
        { quick: MENU_QUICK },
      );
    default:
      return one(
        'Hmm, não entendi bem. 🤔 Tente, por exemplo: “quem eu vou atender hoje?”, “cadastrar paciente” ou “pagamentos pendentes”.',
        { quick: MENU_QUICK },
      );
  }
}
