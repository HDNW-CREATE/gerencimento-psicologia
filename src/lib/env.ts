import { z } from 'zod';

/**
 * Variáveis de ambiente validadas. A validação é preguiçosa (na primeira leitura)
 * para não quebrar o `next build` quando segredos ainda não existem no ambiente de build.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET precisa ter ao menos 16 caracteres'),
  CLINICAL_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, {
    message: 'CLINICAL_ENCRYPTION_KEY deve ser 32 bytes em base64 (use `npm run gen:key`)',
  }),
  CRON_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Consultório <onboarding@resend.dev>'),
  EMAIL_ADMIN_NOTIFY: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  E2E_MAIL_SINK: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    // Só os NOMES e problemas – nunca os valores.
    throw new Error(`Variáveis de ambiente inválidas: ${problems}`);
  }
  cached = parsed.data;
  return cached;
}

export const appUrl = () => env().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
