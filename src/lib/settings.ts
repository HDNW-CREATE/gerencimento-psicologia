import { cache } from 'react';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from './db';

/* ────────────────────────── Dados profissionais ────────────────────────── */
export const clinicSchema = z.object({
  clinicName: z.string().default('Espaço Acolher – Psicologia'),
  professionalName: z.string().default('Dra. Ana Exemplo'),
  crp: z.string().default('CRP 00/00000'),
  document: z.string().default(''), // CPF ou CNPJ para recibos
  email: z.string().default('contato@consultorio.local'),
  phone: z.string().default(''),
  whatsapp: z.string().default(''),
  instagram: z.string().default(''),
  addressLine: z.string().default('Rua Exemplo, 123 – sala 45'),
  city: z.string().default('São Paulo'),
  state: z.string().default('SP'),
  zip: z.string().default(''),
  photoKey: z.string().default(''), // chave pública no storage (public/...)
  signatureKey: z.string().default(''), // imagem da assinatura para recibos
  receiptFooter: z
    .string()
    .default('Recibo emitido para fins de reembolso e declaração de Imposto de Renda.'),
});
export type ClinicSettings = z.infer<typeof clinicSchema>;

/* ────────────────────────── Agendamento ────────────────────────── */
export const schedulingSchema = z.object({
  defaultDurationMinutes: z.number().int().min(10).max(240).default(50),
  gapMinutes: z.number().int().min(0).max(120).default(10),
  stepMinutes: z.number().int().min(10).max(240).default(60),
  minAdvanceHours: z
    .number()
    .min(0)
    .max(24 * 30)
    .default(12),
  minCancelHours: z
    .number()
    .min(0)
    .max(24 * 30)
    .default(24),
  maxAdvanceDays: z.number().int().min(1).max(365).default(60),
  maxFutureAppointments: z.number().int().min(0).max(50).default(3), // 0 = sem limite
  manualApproval: z.boolean().default(true),
  defaultMeetingUrl: z.string().default(''),
  meetingLinkMinutesBefore: z.number().int().min(0).max(120).default(15),
  defaultPriceCents: z.number().int().min(0).default(20000),
  showPricesOnSite: z.boolean().default(true),
  remindersEnabled: z.boolean().default(true),
  reminder24h: z.boolean().default(true),
  reminder2h: z.boolean().default(true),
  paymentReminders: z.boolean().default(false),
  noShowCharged: z.boolean().default(true), // falta sem aviso conta como cobrável
});
export type SchedulingSettings = z.infer<typeof schedulingSchema>;

/* ────────────────────────── Anamnese configurável ────────────────────────── */
export const anamnesisFieldSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'yesno']).default('textarea'),
});
export const anamnesisConfigSchema = z.object({
  fields: z.array(anamnesisFieldSchema).default([
    { key: 'queixa_principal', label: 'Queixa principal / motivo da busca', type: 'textarea' },
    { key: 'historico_familiar', label: 'Histórico familiar', type: 'textarea' },
    { key: 'historico_saude', label: 'Histórico de saúde (física e mental)', type: 'textarea' },
    { key: 'medicamentos', label: 'Medicamentos em uso', type: 'textarea' },
    { key: 'acompanhamento_anterior', label: 'Já fez psicoterapia antes?', type: 'textarea' },
    { key: 'sono_alimentacao', label: 'Sono e alimentação', type: 'textarea' },
    { key: 'rede_apoio', label: 'Rede de apoio', type: 'textarea' },
    { key: 'expectativas', label: 'Expectativas com o processo terapêutico', type: 'textarea' },
  ]),
});
export type AnamnesisConfig = z.infer<typeof anamnesisConfigSchema>;

/* ────────────────────────── Conteúdo do site público ────────────────────────── */
export const siteSchema = z.object({
  heroTitle: z.string().default('Um espaço seguro para cuidar de você'),
  heroSubtitle: z
    .string()
    .default('Psicoterapia individual e de casal, presencial e online, com acolhimento e ética.'),
  ctaLabel: z.string().default('Agendar sessão'),
  aboutTitle: z.string().default('Sobre mim'),
  aboutBody: z
    .string()
    .default(
      'Sou psicóloga clínica e acredito que a terapia é um encontro de cuidado, escuta e transformação.\n\nAtendo adultos, adolescentes e casais, com um olhar respeitoso para a história e o ritmo de cada pessoa.',
    ),
  approachTitle: z.string().default('Abordagem terapêutica'),
  approachBody: z
    .string()
    .default(
      'Trabalho com a Terapia Cognitivo-Comportamental, integrando técnicas de acolhimento e desenvolvimento de recursos emocionais.',
    ),
  specialties: z
    .array(z.string())
    .default(['Ansiedade', 'Depressão', 'Autoestima', 'Relacionamentos', 'Orientação a pais']),
  servicesIntro: z.string().default('Escolha a modalidade que mais combina com o seu momento.'),
  pricingNote: z
    .string()
    .default('Valores sujeitos a alteração. Pacotes de sessões têm condições especiais.'),
  contactIntro: z.string().default('Será um prazer receber o seu contato.'),
  mapsQuery: z.string().default(''), // texto do endereço para o mapa; vazio = usa o endereço do consultório
  showMap: z.boolean().default(true),
  showFaq: z.boolean().default(true),
  seoTitle: z.string().default('Psicóloga em São Paulo | Terapia presencial e online'),
  seoDescription: z
    .string()
    .default('Psicoterapia individual e de casal, presencial e online. Agende sua sessão.'),
});
export type SiteContent = z.infer<typeof siteSchema>;

/* ────────────────────────── Acesso genérico ────────────────────────── */

async function readSetting<T extends z.ZodTypeAny>(key: string, schema: T): Promise<z.infer<T>> {
  const row = await db.setting.findUnique({ where: { key } });
  return schema.parse((row?.value as object | undefined) ?? {});
}

export const getClinic = cache(() => readSetting('clinic', clinicSchema));
export const getScheduling = cache(() => readSetting('scheduling', schedulingSchema));
export const getAnamnesisConfig = cache(() => readSetting('anamnesis', anamnesisConfigSchema));

export const getSite = cache(async (): Promise<SiteContent> => {
  const row = await db.siteContent.findUnique({ where: { key: 'main' } });
  return siteSchema.parse((row?.value as object | undefined) ?? {});
});

export async function saveSetting(key: 'clinic' | 'scheduling' | 'anamnesis', value: unknown) {
  const schema = {
    clinic: clinicSchema,
    scheduling: schedulingSchema,
    anamnesis: anamnesisConfigSchema,
  }[key];
  const parsed = schema.parse(value) as Prisma.InputJsonValue;
  await db.setting.upsert({
    where: { key },
    create: { key, value: parsed },
    update: { value: parsed },
  });
}

export async function saveSite(value: unknown) {
  const parsed = siteSchema.parse(value) as Prisma.InputJsonValue;
  await db.siteContent.upsert({
    where: { key: 'main' },
    create: { key: 'main', value: parsed },
    update: { value: parsed },
  });
}
