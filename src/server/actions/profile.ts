'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { rateLimit, rateLimitMessage } from '@/lib/ratelimit';
import { onlyDigits, optionalCpfSchema, optionalTrimmed, phoneSchema } from '@/lib/validators';
import { fail, ok, run, UserError, type ActionResult } from '../action-result';
import { requirePatientOrThrow } from '../session';

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? onlyDigits(v) : undefined))
  .refine((v) => v === undefined || (v.length >= 10 && v.length <= 13), 'Telefone inválido.');

const profileSchema = z.object({
  socialName: optionalTrimmed(120),
  phone: phoneSchema,
  emergencyName: optionalTrimmed(120),
  emergencyPhone: optionalPhone,
  emergencyRelation: optionalTrimmed(60),
  guardianName: optionalTrimmed(120),
  guardianCpf: optionalCpfSchema,
  guardianPhone: optionalPhone,
  notifyReminders: z.boolean(),
  notifyPayments: z.boolean(),
  notifyAnnouncements: z.boolean(),
});

/**
 * O paciente edita APENAS a própria ficha (o id vem da sessão, nunca do cliente) e apenas
 * campos permitidos: nome, CPF, e-mail e situação cadastral só a equipe altera.
 */
export async function updateMyProfileAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePatientOrThrow();
    const d = profileSchema.parse(input);
    await db.$transaction([
      db.patientProfile.update({
        where: { id: user.patientProfile.id },
        data: {
          socialName: d.socialName ?? null,
          phone: d.phone,
          emergencyName: d.emergencyName ?? null,
          emergencyPhone: d.emergencyPhone ?? null,
          emergencyRelation: d.emergencyRelation ?? null,
          guardianName: d.guardianName ?? null,
          guardianCpf: d.guardianCpf ?? null,
          guardianPhone: d.guardianPhone ?? null,
        },
      }),
      db.user.update({
        where: { id: user.id },
        data: {
          notifyReminders: d.notifyReminders,
          notifyPayments: d.notifyPayments,
          notifyAnnouncements: d.notifyAnnouncements,
          name: d.socialName ?? user.patientProfile.fullName,
        },
      }),
    ]);
    await audit({
      action: 'PATIENT_UPDATE',
      actorId: user.id,
      actorRole: user.role,
      entity: 'PatientProfile',
      entityId: user.patientProfile.id,
      metadata: { self: true },
    });
    revalidatePath('/paciente', 'layout');
    return ok('Perfil atualizado.');
  });
}

/** LGPD: pedido de exportação ou exclusão (analisado pela psicóloga). */
export async function createDataRequestAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePatientOrThrow();
    const rl = await rateLimit(`lgpd:${user.id}`, 3, 24 * 60 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));
    const d = z
      .object({ type: z.enum(['EXPORTACAO', 'EXCLUSAO']), message: optionalTrimmed(500) })
      .parse(input);

    const open = await db.dataRequest.count({
      where: { userId: user.id, type: d.type, status: { in: ['ABERTA', 'EM_ANALISE'] } },
    });
    if (open > 0) throw new UserError('Você já possui um pedido deste tipo em andamento.');

    const r = await db.dataRequest.create({
      data: { userId: user.id, type: d.type, message: d.message },
    });
    await audit({
      action: 'DATA_REQUEST_CREATE',
      actorId: user.id,
      actorRole: user.role,
      entity: 'DataRequest',
      entityId: r.id,
      metadata: { type: d.type },
    });
    revalidatePath('/paciente/privacidade');
    return ok('Pedido registrado. A psicóloga analisará e retornará por e-mail.');
  });
}
