import { z } from 'zod';

/** Remove tudo que não for dígito. */
export const onlyDigits = (v: string) => v.replace(/\D/g, '');

/** Valida CPF pelos dígitos verificadores. */
export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** Política de senha: mínimo 8, com letras e números. */
export const passwordSchema = z
  .string({ required_error: 'Informe a senha.' })
  .min(8, 'A senha deve ter no mínimo 8 caracteres.')
  .max(128, 'A senha é muito longa.')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra.')
  .regex(/\d/, 'A senha deve conter ao menos um número.');

export const emailSchema = z
  .string({ required_error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .email('E-mail inválido.')
  .max(254);

export const phoneSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone inválido. Use DDD + número.');

export const cpfSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine(isValidCpf, 'CPF inválido.');

/** CPF opcional: string vazia vira undefined. */
export const optionalCpfSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? onlyDigits(v) : undefined))
  .refine((v) => v === undefined || isValidCpf(v), 'CPF inválido.');

export const optionalTrimmed = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .refine((v) => {
    const [y, m, d] = v.split('-').map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
  }, 'Data inválida.');

/** Data de nascimento: não pode ser futura nem anterior a 1900. */
export const birthDateSchema = ymdSchema.refine((v) => {
  const dt = new Date(`${v}T00:00:00Z`);
  return dt.getTime() <= Date.now() && dt.getUTCFullYear() >= 1900;
}, 'Data de nascimento inválida.');

export const urlSchema = z
  .string()
  .trim()
  .url('Link inválido.')
  .refine((v) => /^https:\/\//i.test(v), 'O link deve começar com https://');

export const optionalUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^https:\/\/\S+$/i.test(v), 'O link deve começar com https://');

/** Idade em anos completos na data de referência. */
export function ageOn(birthYmd: string, ref = new Date()): number {
  const [y, m, d] = birthYmd.split('-').map(Number);
  let age = ref.getUTCFullYear() - y!;
  const had =
    ref.getUTCMonth() + 1 > m! || (ref.getUTCMonth() + 1 === m! && ref.getUTCDate() >= d!);
  if (!had) age -= 1;
  return age;
}

export const isMinor = (birthYmd: string, ref = new Date()) => ageOn(birthYmd, ref) < 18;

/** Centavos a partir de "R$ 1.234,56" / "1234,56" / "1234.56". */
export function parseMoneyToCents(input: string): number | null {
  const clean = input.replace(/[^\d,.-]/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
