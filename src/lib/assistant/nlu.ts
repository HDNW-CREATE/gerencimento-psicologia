import type { RegisterData } from './types';
import { isValidCpf } from '../validators';

/**
 * Entendimento de linguagem natural SIMPLES e local (sem IA externa):
 * normaliza o texto e reconhece intenções por palavras-chave. Funções puras e testáveis.
 */

/** minúsculas, sem acentos, espaços e pontuação simplificados. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@./:+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const has = (t: string, re: RegExp) => re.test(t);

export const isYes = (t: string) =>
  has(
    normalize(t),
    /^(sim|s|isso|ok|certo|confirmo|confirmar|confirma|pode|pode salvar|salvar|correto|exato|claro|com certeza|yes)\b/,
  );
export const isNo = (t: string) => has(normalize(t), /^(nao|n|negativo|errado|incorreto)\b/);
export const isSkip = (t: string) =>
  has(
    normalize(t),
    /^(pular|pula|nao tem|sem|nenhum|nenhuma|nao sei|depois|\-|nao informar|prefiro nao)\b/,
  );
export const isCancel = (t: string) =>
  has(normalize(t), /\b(cancelar|cancela|sair|desistir|esquece|deixa pra la|parar|abortar)\b/);
export const isFix = (t: string) =>
  has(normalize(t), /\b(corrigir|corrige|alterar|mudar|refazer|editar)\b/);

/* ───────────────────────── Intenções da psicóloga / equipe ───────────────────────── */

export type StaffIntent =
  | 'register'
  | 'clinical'
  | 'search'
  | 'approvals'
  | 'payments'
  | 'summary'
  | 'tomorrow'
  | 'week'
  | 'next'
  | 'today'
  | 'help'
  | 'greeting'
  | 'thanks'
  | 'unknown';

export function detectStaffIntent(text: string): StaffIntent {
  const t = normalize(text);
  if (!t) return 'unknown';
  if (
    has(
      t,
      /\b(cadastr\w*|novo paciente|nova paciente|adicionar (um |o |a )?(novo |nova )?(paciente|cliente)|incluir (um |o |a )?(paciente|cliente)|registrar (um |o |a )?(paciente|cliente))\b/,
    )
  )
    return 'register';
  if (has(t, /\b(prontuario|evolucao|anamnese|anotacoes? clinic\w*)\b/)) return 'clinical';
  if (
    has(
      t,
      /\b(buscar|busque|procurar|procure|achar|encontrar|localizar|ficha d[aeo]|dados d[aeo]|telefone d[aeo]|contato d[aeo]|quem e)\b/,
    ) &&
    !has(t, /\b(hoje|amanha|semana)\b/)
  )
    return 'search';
  if (
    has(t, /\b(pedidos?|solicitac\w+|aprovar|aprovacao|aguardando|pendentes?)\b/) &&
    has(t, /\b(agend\w*|sess\w+|pedidos?|horario\w*|consultas?)\b/) &&
    !has(t, /\bpagament\w+/)
  )
    return 'approvals';
  if (
    has(
      t,
      /\b(pagament\w*|devendo|devedor\w*|inadimpl\w*|a receber|atrasad\w*|financeiro|cobranc\w*|em aberto)\b/,
    )
  )
    return 'payments';
  if (has(t, /\b(resumo|balanco|faturamento|faturei|recebi|indicadores?|desempenho|numeros)\b/))
    return 'summary';
  if (has(t, /\bamanha\b/)) return 'tomorrow';
  if (has(t, /\b(semana|proximos dias)\b/)) return 'week';
  if (has(t, /\b(proxim[oa]s?)\b/) && has(t, /\b(sess\w+|paciente|atendimento|consulta)\b/))
    return 'next';
  if (
    has(t, /\bhoje\b/) ||
    has(t, /\bquem\b.*\b(atend\w*|ver|sess\w+|vem)\b/) ||
    has(t, /\b(minha |a )?agenda\b/)
  )
    return 'today';
  if (has(t, /\b(ajuda|help|o que (voce )?(faz|pode)|comandos?|menu|opcoes)\b/)) return 'help';
  if (has(t, /^(oi+|ola|opa|bom dia|boa tarde|boa noite|e ai|hey|eae)\b/)) return 'greeting';
  if (has(t, /\b(obrigad\w+|valeu|brigad\w+|thanks)\b/)) return 'thanks';
  return 'unknown';
}

/** Extrai o termo de busca de frases como "buscar Maria Silva" / "telefone da Ana". */
export function extractSearchTerm(text: string): string | null {
  const m =
    /(?:buscar|busque|procurar|procure|achar|encontrar|localizar|ficha\s+(?:d[aeo]s?)?|dados\s+(?:d[aeo]s?)?|telefone\s+(?:d[aeo]s?)?|contato\s+(?:d[aeo]s?)?|quem\s+(?:e|é)\s+(?:a|o)?)\s*(?:o\s+|a\s+)?(?:paciente\s+|cliente\s+)?([\p{L}'\- ]{2,60})/iu.exec(
      text,
    );
  const term = m?.[1]?.trim().replace(/\s+(por favor|pf|pfv)$/i, '');
  return term && term.length >= 2 ? term : null;
}

/* ───────────────────────── Intenções do paciente ───────────────────────── */

export type PatientIntent =
  | 'crisis'
  | 'next_session'
  | 'availability'
  | 'book'
  | 'reschedule'
  | 'cancel'
  | 'payments'
  | 'receipt'
  | 'price'
  | 'documents'
  | 'contact'
  | 'online_link'
  | 'privacy'
  | 'account'
  | 'help'
  | 'greeting'
  | 'thanks'
  | 'unknown';

/** Sinais de risco: a resposta de segurança tem prioridade sobre qualquer outra. */
const CRISIS_RE =
  /\b(suicid\w*|me matar|quero morrer|vou me matar|nao quero mais viver|nao aguento mais viver|acabar com (a )?minha vida|tirar (a )?minha vida|me machucar|me cortar|automutilac\w*|pensando em morrer|melhor (eu )?morrer|sumir de vez)\b/;

export const isCrisis = (text: string) => CRISIS_RE.test(normalize(text));

export function detectPatientIntent(text: string): PatientIntent {
  const t = normalize(text);
  if (!t) return 'unknown';
  if (CRISIS_RE.test(t)) return 'crisis';
  if (has(t, /\b(remarcar|reagendar|trocar (o )?(dia|horario)|mudar (o )?(dia|horario)|adiar)\b/))
    return 'reschedule';
  if (has(t, /\b(cancelar|desmarcar)\b/)) return 'cancel';
  if (has(t, /\b(recibo|comprovante|reembolso|imposto de renda|nota fiscal)\b/)) return 'receipt';
  if (has(t, /\b(pagamento|pagar|pendente|pendencia|devo|paguei|cobranca|financeiro|em aberto)\b/))
    return 'payments';
  if (has(t, /\b(quanto custa|quanto e|valor|preco|investimento|mensalidade)\b/)) return 'price';
  if (has(t, /\b(horarios?|vagas?|disponivel|disponiveis|disponibilidade|tem horario)\b/))
    return 'availability';
  if (
    has(t, /\b(proxim[oa]|quando).*\b(sessao|consulta|atendimento)\b/) ||
    has(t, /\bminha (sessao|consulta)\b/) ||
    has(t, /\bquando (e|eh|sera)\b/)
  )
    return 'next_session';
  if (has(t, /\b(agendar|marcar|nova sessao|nova consulta|quero uma sessao)\b/)) return 'book';
  if (
    has(t, /\b(link|entrar na sessao|video ?chamada|meet|zoom|sessao online|como (entro|acesso))\b/)
  )
    return 'online_link';
  if (has(t, /\b(documentos?|atestado|declaracao|laudo)\b/)) return 'documents';
  if (
    has(
      t,
      /\b(endereco|onde fica|localizacao|como chegar|telefone|whatsapp|contato|e-?mail do consultorio|falar com)\b/,
    )
  )
    return 'contact';
  if (
    has(t, /\b(lgpd|privacidade|meus dados|excluir (minha )?conta|apagar (meus )?dados|sigilo)\b/)
  )
    return 'privacy';
  if (
    has(t, /\b(senha|login|perfil|trocar (meu )?(telefone|nome|dados)|atualizar (meus )?dados)\b/)
  )
    return 'account';
  if (has(t, /\b(ajuda|help|o que (voce )?(faz|pode)|menu|opcoes)\b/)) return 'help';
  if (has(t, /^(oi+|ola|opa|bom dia|boa tarde|boa noite|e ai|hey)\b/)) return 'greeting';
  if (has(t, /\b(obrigad\w+|valeu|brigad\w+)\b/)) return 'thanks';
  return 'unknown';
}

/* ───────────────────────── Extração de dados de cadastro ───────────────────────── */

export const parseEmail = (text: string): string | null => {
  const m = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(text);
  return m ? m[0].toLowerCase() : null;
};

/** Telefone brasileiro (10–11 dígitos, aceita +55). Retorna só dígitos ou null. */
export function parsePhone(text: string): string | null {
  const m = /(?:\+?55[\s-]*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]?\d{4}/.exec(
    text.replace(/\d{2}\/\d{2}\/\d{4}/g, ''),
  );
  if (!m) return null;
  let digits = m[0].replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

/** Data de nascimento: aceita 12/03/1990, 12-03-1990 ou 1990-03-12. Retorna YYYY-MM-DD, null (não achou) ou 'invalid'. */
export function parseBirth(text: string): string | null | 'invalid' {
  const br = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(text);
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (br) [d, m, y] = [Number(br[1]), Number(br[2]), Number(br[3])];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const valid =
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d &&
    y >= 1900 &&
    dt.getTime() <= Date.now();
  return valid
    ? `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : 'invalid';
}

function parseCpf(text: string): string | null {
  const m = /cpf[^\d]{0,6}([\d.\-\s]{11,14})/i.exec(text);
  if (!m) return null;
  const digits = m[1]!.replace(/\D/g, '');
  return digits.length === 11 && isValidCpf(digits) ? digits : null;
}

const NAME_STOP =
  /(?:,|;|\bcpf\b|\btel\w*\b|\bcelular\b|\bwhats\w*\b|\bfone\b|\be-?mail\b|\bnasc\w*\b|\bnascido\b|\bdata\b|\bidade\b|\d|@)/i;

const TITLE_SMALL = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
export function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && TITLE_SMALL.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
}

/** Nome válido: só letras, espaços, apóstrofo e hífen; ao menos 2 palavras ou 3 letras. */
export function cleanName(raw: string): string | null {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}][\p{L}'\- ]{1,118}$/u.test(s) || s.length < 3) return null;
  return /[a-zà-ú]/.test(s) && s === s.toLowerCase() ? titleCase(s) : s;
}

/**
 * Lê uma frase como "cadastrar paciente Maria Souza, telefone (11) 98888-7777, e-mail maria@x.com,
 * nascimento 12/03/1990" e devolve o que conseguir identificar.
 */
export function parsePatientDetails(text: string): RegisterData {
  const data: RegisterData = {};
  // Nome: logo depois do verbo/“paciente”, até o primeiro dado (vírgula, número, palavra-chave).
  const head =
    /(?:cadastr\w*|adicionar|incluir|registrar)\s+(?:(?:um|uma|o|a)\s+)?(?:(?:novo|nova)\s+)?(?:paciente|cliente)?\s*(?:chamad[oa]\s+|de nome\s+|:)?\s*(.*)$/is.exec(
      text,
    );
  if (head?.[1]) {
    const chunk = head[1];
    const stop = NAME_STOP.exec(chunk);
    const name = cleanName(
      (stop ? chunk.slice(0, stop.index) : chunk).replace(/^(?:o|a|um|uma)\s+/i, ''),
    );
    if (name) data.fullName = name;
  }
  const phone = parsePhone(text);
  if (phone) data.phone = phone;
  const email = parseEmail(text);
  if (email) data.email = email;
  const birth = parseBirth(text);
  if (birth && birth !== 'invalid') data.birthDate = birth;
  const cpf = parseCpf(text);
  if (cpf) data.cpf = cpf;
  return data;
}
