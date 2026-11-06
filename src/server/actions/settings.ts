'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import {
  anamnesisConfigSchema,
  clinicSchema,
  saveSetting,
  saveSite,
  schedulingSchema,
  siteSchema,
} from '@/lib/settings';
import { parseHHmm } from '@/lib/domain/time';
import { optionalTrimmed } from '@/lib/validators';
import { ok, run, UserError, type ActionResult } from '../action-result';
import { requirePermissionOrThrow } from '../session';

function refresh() {
  revalidatePath('/', 'layout');
}

/* ───────────────────── Disponibilidade semanal ───────────────────── */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.');
const availabilitySchema = z.object({
  rules: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start: hhmm,
        end: hhmm,
        modality: z.enum(['PRESENCIAL', 'ONLINE']).nullable(),
      }),
    )
    .max(100),
});

export async function saveAvailabilityAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const { rules } = availabilitySchema.parse(input);
    const rows = rules.map((r) => ({
      weekday: r.weekday,
      startMinute: parseHHmm(r.start),
      endMinute: parseHHmm(r.end),
      modality: r.modality,
    }));
    for (const r of rows) {
      if (r.endMinute <= r.startMinute)
        throw new UserError('O horário final deve ser depois do inicial.');
    }
    await db.$transaction([
      db.availabilityRule.deleteMany({}),
      db.availabilityRule.createMany({ data: rows }),
    ]);
    await audit({
      action: 'AVAILABILITY_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { intervals: rows.length },
    });
    refresh();
    return ok('Horários de atendimento salvos.');
  });
}

const blockSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: optionalTrimmed(200),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'O fim deve ser depois do início.',
    path: ['endsAt'],
  });

export async function createBlockAction(
  input: unknown,
): Promise<ActionResult<{ conflicts: number }>> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('agenda.manage');
    const d = blockSchema.parse(input);
    const startsAt = new Date(d.startsAt);
    const endsAt = new Date(d.endsAt);
    await db.availabilityBlock.create({ data: { startsAt, endsAt, reason: d.reason } });
    // Avisa quantas sessões já marcadas caem dentro do bloqueio (a psicóloga decide o que fazer)
    const conflicts = await db.appointment.count({
      where: {
        deletedAt: null,
        status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    await audit({
      action: 'AVAILABILITY_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { block: true },
    });
    refresh();
    return ok(
      conflicts
        ? `Bloqueio criado. Atenção: ${conflicts} sessão(ões) já marcada(s) neste período.`
        : 'Bloqueio criado.',
      { conflicts },
    );
  });
}

export async function deleteBlockAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('agenda.manage');
    const { id } = z.object({ id: z.string() }).parse(input);
    await db.availabilityBlock.delete({ where: { id } });
    await audit({
      action: 'AVAILABILITY_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { blockRemoved: true },
    });
    refresh();
    return ok('Bloqueio removido.');
  });
}

/* ───────────────────── Configurações gerais ───────────────────── */

export async function saveSchedulingAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const d = schedulingSchema.parse(input);
    if (d.defaultMeetingUrl && !/^https:\/\/\S+$/i.test(d.defaultMeetingUrl)) {
      throw new UserError('O link de videochamada deve começar com https://', {
        defaultMeetingUrl: ['Link inválido.'],
      });
    }
    await saveSetting('scheduling', d);
    await audit({
      action: 'SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Setting',
      entityId: 'scheduling',
    });
    refresh();
    return ok('Configurações de agendamento salvas.');
  });
}

export async function saveClinicAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const d = clinicSchema.parse(input);
    await saveSetting('clinic', d);
    await audit({
      action: 'SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Setting',
      entityId: 'clinic',
    });
    refresh();
    return ok('Dados profissionais salvos.');
  });
}

export async function saveAnamnesisConfigAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const d = anamnesisConfigSchema.parse(input);
    const keys = new Set(d.fields.map((f) => f.key));
    if (keys.size !== d.fields.length) throw new UserError('Há campos com identificador repetido.');
    await saveSetting('anamnesis', d);
    await audit({
      action: 'SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Setting',
      entityId: 'anamnesis',
    });
    return ok('Campos da anamnese salvos.');
  });
}

/* ───────────────────── Conteúdo do site ───────────────────── */

export async function saveSiteAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('site.manage');
    const d = siteSchema.parse(input);
    await saveSite(d);
    await audit({ action: 'SITE_CONTENT_UPDATE', actorId: actor.id, actorRole: actor.role });
    refresh();
    return ok('Conteúdo do site atualizado.');
  });
}

const faqSchema = z.object({
  id: z.string().optional(),
  question: z.string().trim().min(3, 'Informe a pergunta.').max(200),
  answer: z.string().trim().min(3, 'Informe a resposta.').max(2000),
  published: z.boolean().default(true),
});

export async function saveFaqAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('site.manage');
    const d = faqSchema.parse(input);
    if (d.id)
      await db.faq.update({
        where: { id: d.id },
        data: { question: d.question, answer: d.answer, published: d.published },
      });
    else {
      const last = await db.faq.aggregate({ _max: { sortOrder: true } });
      await db.faq.create({
        data: {
          question: d.question,
          answer: d.answer,
          published: d.published,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
        },
      });
    }
    await audit({
      action: 'SITE_CONTENT_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Faq',
    });
    refresh();
    return ok('Pergunta salva.');
  });
}

export async function deleteFaqAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('site.manage');
    const { id } = z.object({ id: z.string() }).parse(input);
    await db.faq.delete({ where: { id } });
    await audit({
      action: 'SITE_CONTENT_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Faq',
      metadata: { removed: true },
    });
    refresh();
    return ok('Pergunta removida.');
  });
}

/* ───────────────────── Serviços ───────────────────── */

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, 'Informe o nome.').max(80),
  description: optionalTrimmed(300),
  durationMinutes: z.number().int().min(10).max(240),
  priceCents: z.number().int().min(0),
  allowsOnline: z.boolean(),
  allowsInPerson: z.boolean(),
  isCouple: z.boolean(),
  showPrice: z.boolean(),
  showOnSite: z.boolean(),
  active: z.boolean(),
});

export async function saveServiceAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const { id, ...d } = serviceSchema.parse(input);
    if (!d.allowsOnline && !d.allowsInPerson)
      throw new UserError('Escolha ao menos uma modalidade (online ou presencial).');
    if (id) await db.serviceType.update({ where: { id }, data: d });
    else {
      const last = await db.serviceType.aggregate({ _max: { sortOrder: true } });
      await db.serviceType.create({ data: { ...d, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    }
    await audit({
      action: 'SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'ServiceType',
      entityId: id,
    });
    refresh();
    return ok('Serviço salvo.');
  });
}

export async function deleteServiceAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const { id } = z.object({ id: z.string() }).parse(input);
    // Soft delete: sessões antigas continuam apontando para o serviço
    await db.serviceType.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    await audit({
      action: 'SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'ServiceType',
      entityId: id,
      metadata: { removed: true },
    });
    refresh();
    return ok('Serviço removido.');
  });
}

/* ───────────────────── Termos e políticas (versionados) ───────────────────── */

export async function publishLegalDocumentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const d = z
      .object({
        type: z.enum(['TERMO_CONSENTIMENTO', 'POLITICA_PRIVACIDADE', 'TERMOS_DE_USO']),
        title: z.string().trim().min(3).max(120),
        content: z.string().trim().min(30, 'O texto está muito curto.').max(40_000),
      })
      .parse(input);
    const last = await db.legalDocument.findFirst({
      where: { type: d.type },
      orderBy: { version: 'desc' },
    });
    const created = await db.legalDocument.create({
      data: { ...d, version: (last?.version ?? 0) + 1 },
    });
    await audit({
      action: 'LEGAL_DOCUMENT_PUBLISH',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'LegalDocument',
      entityId: created.id,
      metadata: { version: created.version, type: d.type },
    });
    refresh();
    return ok(`Nova versão publicada (v${created.version}).`);
  });
}

/* ───────────────────── Templates de e-mail ───────────────────── */

export async function saveEmailTemplateAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('communication.send');
    const d = z
      .object({
        key: z.string().min(1),
        subject: z.string().trim().min(3, 'Informe o assunto.').max(200),
        body: z.string().trim().min(3, 'Informe a mensagem.').max(8000),
        active: z.boolean(),
      })
      .parse(input);
    await db.emailTemplate.update({
      where: { key: d.key },
      data: { subject: d.subject, body: d.body, active: d.active },
    });
    await audit({
      action: 'SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'EmailTemplate',
      entityId: d.key,
    });
    return ok('Modelo de e-mail salvo.');
  });
}
