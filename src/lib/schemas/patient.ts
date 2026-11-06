import { z } from 'zod';
import {
  emailSchema,
  onlyDigits,
  optionalCpfSchema,
  optionalTrimmed,
  ymdSchema,
} from '../validators';

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? onlyDigits(v) : undefined))
  .refine(
    (v) => v === undefined || (v.length >= 10 && v.length <= 13),
    'Telefone inválido. Use DDD + número.',
  );

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || emailSchema.safeParse(v).success, 'E-mail inválido.');

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || ymdSchema.safeParse(v).success, 'Data inválida.');

/** Cadastro rápido (paciente sem conta). */
export const quickPatientSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  phone: optionalPhone,
  email: optionalEmail,
});

export const patientSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  socialName: optionalTrimmed(120),
  email: optionalEmail,
  phone: optionalPhone,
  birthDate: optionalDate,
  cpf: optionalCpfSchema,
  status: z.enum(['ATIVO', 'INATIVO', 'ALTA']).default('ATIVO'),

  guardianName: optionalTrimmed(120),
  guardianCpf: optionalCpfSchema,
  guardianPhone: optionalPhone,
  guardianEmail: optionalEmail,
  guardianRelation: optionalTrimmed(60),

  emergencyName: optionalTrimmed(120),
  emergencyPhone: optionalPhone,
  emergencyRelation: optionalTrimmed(60),

  partnerName: optionalTrimmed(120),
  partnerPhone: optionalPhone,
  partnerEmail: optionalEmail,

  adminNotes: optionalTrimmed(2000),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  /** Valor personalizado por sessão em reais ("180,00"); vazio = usa o do serviço. */
  customPrice: z.string().trim().optional(),
});

export type PatientInput = z.input<typeof patientSchema>;
