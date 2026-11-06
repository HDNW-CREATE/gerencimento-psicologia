import { z } from 'zod';
import {
  birthDateSchema,
  emailSchema,
  isMinor,
  optionalCpfSchema,
  optionalTrimmed,
  passwordSchema,
  phoneSchema,
  cpfSchema,
} from '../validators';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.').max(128),
  callbackUrl: z.string().optional(),
});
export type LoginInput = z.input<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Informe o nome completo.').max(120),
    socialName: optionalTrimmed(120),
    email: emailSchema,
    phone: phoneSchema,
    birthDate: birthDateSchema,
    cpf: optionalCpfSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({
        message: 'É necessário aceitar o Termo de Consentimento e a Política de Privacidade.',
      }),
    }),
    // Responsável legal (obrigatório para menores de 18 anos)
    guardianName: optionalTrimmed(120),
    guardianCpf: optionalCpfSchema,
    guardianPhone: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, '') : undefined)),
    guardianEmail: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'As senhas não conferem.',
      });
    }
    if (isMinor(v.birthDate)) {
      if (!v.guardianName) {
        ctx.addIssue({
          code: 'custom',
          path: ['guardianName'],
          message: 'Informe o nome do responsável legal.',
        });
      }
      if (!v.guardianCpf) {
        ctx.addIssue({
          code: 'custom',
          path: ['guardianCpf'],
          message: 'Informe o CPF do responsável.',
        });
      }
      if (!v.guardianPhone || v.guardianPhone.length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['guardianPhone'],
          message: 'Informe o telefone do responsável.',
        });
      }
    }
  });
export type RegisterInput = z.input<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });

export { cpfSchema };
