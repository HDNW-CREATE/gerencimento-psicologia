'use server';

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { ok, run, UserError, type ActionResult } from '../action-result';
import { requirePermissionOrThrow } from '../session';

/**
 * Resolve um pedido LGPD.
 *  • EXPORTACAO → conclui (a exportação é baixada em /api/export/lgpd/[id] e enviada ao titular).
 *  • EXCLUSAO + "anonimizar" → remove a conta e os dados de contato, MAS preserva o prontuário e o
 *    histórico financeiro vinculados à ficha (obrigação legal de guarda – mínimo de 5 anos).
 *  • NEGADA → exige justificativa.
 */
export async function resolveDataRequestAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('lgpd.manage');
    const d = z
      .object({
        id: z.string(),
        decision: z.enum(['EM_ANALISE', 'CONCLUIDA', 'NEGADA']),
        note: z.string().trim().max(500).optional(),
        anonymize: z.boolean().optional(),
      })
      .parse(input);
    if (d.decision === 'NEGADA' && (!d.note || d.note.length < 5))
      throw new UserError('Informe a justificativa da negativa.');

    const req = await db.dataRequest.findUnique({
      where: { id: d.id },
      include: { user: { include: { patientProfile: true } } },
    });
    if (!req) throw new UserError('Pedido não encontrado.');
    if (['CONCLUIDA', 'NEGADA'].includes(req.status))
      throw new UserError('Este pedido já foi encerrado.');

    if (d.decision === 'CONCLUIDA' && req.type === 'EXCLUSAO' && d.anonymize) {
      const patientId = req.user.patientProfile?.id;
      if (patientId) {
        const open = await db.appointment.count({
          where: {
            patientId,
            deletedAt: null,
            status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
            startsAt: { gt: new Date() },
          },
        });
        if (open > 0)
          throw new UserError(
            'O paciente tem sessões futuras em aberto. Cancele-as antes de anonimizar.',
          );
      }
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: req.userId },
          data: {
            deletedAt: new Date(),
            email: `removido+${req.userId}@invalid.local`,
            name: 'Usuário removido',
            passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
            sessionVersion: { increment: 1 },
          },
        });
        if (patientId) {
          // Mantém nome e nascimento (identificação mínima do prontuário retido); apaga contatos e dados acessórios.
          await tx.patientProfile.update({
            where: { id: patientId },
            data: {
              userId: null,
              status: 'INATIVO',
              email: null,
              phone: null,
              cpf: null,
              socialName: null,
              guardianName: null,
              guardianCpf: null,
              guardianPhone: null,
              guardianEmail: null,
              guardianRelation: null,
              emergencyName: null,
              emergencyPhone: null,
              emergencyRelation: null,
              partnerName: null,
              partnerPhone: null,
              partnerEmail: null,
              adminNotes: null,
              tags: [],
              deletedAt: new Date(),
            },
          });
          await tx.document.updateMany({
            where: { patientId },
            data: { sharedWithPatient: false },
          });
        }
      });
    }

    await db.dataRequest.update({
      where: { id: d.id },
      data: {
        status: d.decision,
        resolutionNote: d.note,
        resolvedById: actor.id,
        resolvedAt: d.decision === 'EM_ANALISE' ? null : new Date(),
      },
    });
    await audit({
      action: 'DATA_REQUEST_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'DataRequest',
      entityId: d.id,
      metadata: { decision: d.decision, anonymized: !!d.anonymize },
    });
    revalidatePath('/admin', 'layout');
    return ok('Pedido atualizado.');
  });
}
