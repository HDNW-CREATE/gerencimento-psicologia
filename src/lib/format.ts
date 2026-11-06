import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { TZ } from './domain/time';

export const formatBRL = (cents: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);

export const fmtDate = (d: Date | string, pattern = 'dd/MM/yyyy') =>
  formatInTimeZone(typeof d === 'string' ? new Date(d) : d, TZ, pattern, { locale: ptBR });

export const fmtTime = (d: Date | string) => fmtDate(d, 'HH:mm');

export const fmtDateTime = (d: Date | string) => fmtDate(d, "dd/MM/yyyy 'às' HH:mm");

export const fmtLongDate = (d: Date | string) => fmtDate(d, "EEEE, d 'de' MMMM 'de' yyyy");

/** Data guardada como @db.Date (meia-noite UTC) → dd/MM/yyyy sem deslocar de dia. */
export const fmtDateOnly = (d: Date | string) =>
  formatInTimeZone(typeof d === 'string' ? new Date(d) : d, 'UTC', 'dd/MM/yyyy');

export const toYmdUtc = (d: Date) => d.toISOString().slice(0, 10);

export function maskCpf(cpf?: string | null) {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskPhone(phone?: string | null) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

/** Link wa.me com mensagem pré-preenchida (assume Brasil quando não há DDI). */
export function whatsappLink(phone: string, message?: string) {
  let d = phone.replace(/\D/g, '');
  if (d.length <= 11) d = `55${d}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${d}${text}`;
}

export const statusLabels: Record<string, string> = {
  PENDENTE: 'Aguardando confirmação',
  AGENDADA: 'Agendada',
  CONFIRMADA: 'Confirmada',
  REALIZADA: 'Realizada',
  FALTA: 'Falta',
  CANCELADA_PACIENTE: 'Cancelada pelo paciente',
  CANCELADA_PSICOLOGA: 'Cancelada pela psicóloga',
  RECUSADA: 'Recusada',
};

export const paymentStatusLabels: Record<string, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  ISENTO: 'Isento',
};

export const paymentMethodLabels: Record<string, string> = {
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  CARTAO: 'Cartão',
  TRANSFERENCIA: 'Transferência',
};

export const modalityLabels: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  ONLINE: 'Online',
};

export const patientStatusLabels: Record<string, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  ALTA: 'Alta',
};

export const weekdayLabels = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];
