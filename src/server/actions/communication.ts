'use server';

import { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { rateLimit, rateLimitMessage } from '@/lib/ratelimit';
import { fail, ok, run, UserError, type ActionResult } from '../action-result';
import { sendTemplateEmail } from '../notifications';
import { requirePermissionOrThrow } from '../session';

const MAX_RECIPIENTS = 300;

/** Envia um aviso a um paciente ou a todos os pacientes ativos (respeitando a preferência de avisos). */
export async function sendAnnouncementAction(
  input: unknown,
): Promise<ActionResult<{ sent: number; skipped: number }>> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('communication.send');
    const rl = await rateLimit(`announce:${actor.id}`, 10, 60 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));

    const d = z
      .object({
        scope: z.enum(['one', 'all']),
        patientId: z.string().optional(),
        subject: z.string().trim().min(3, 'Informe o assunto.').max(150),
        message: z.string().trim().min(5, 'Escreva a mensagem.').max(4000),
      })
      .parse(input);

    const patients =
      d.scope === 'one'
        ? await db.patientProfile.findMany({
            where: { id: d.patientId ?? '__none__', deletedAt: null },
            include: { user: { select: { email: true, notifyAnnouncements: true } } },
          })
        : await db.patientProfile.findMany({
            where: { status: 'ATIVO', deletedAt: null },
            include: { user: { select: { email: true, notifyAnnouncements: true } } },
            take: MAX_RECIPIENTS,
          });
    if (patients.length === 0) throw new UserError('Nenhum destinatário encontrado.');

    let sent = 0;
    let skipped = 0;
    for (const p of patients) {
      const to = p.user?.email ?? p.email;
      // Aviso individual vai sempre; aviso em massa respeita a preferência do paciente
      const optedOut = d.scope === 'all' && p.user && !p.user.notifyAnnouncements;
      if (!to || optedOut) {
        skipped++;
        continue;
      }
      const r = await sendTemplateEmail({
        templateKey: 'announcement',
        to,
        userId: p.userId ?? undefined,
        vars: {
          nome: p.socialName ?? p.fullName.split(' ')[0],
          assunto: d.subject,
          mensagem: d.message,
        },
      });
      if (r.ok) sent++;
      else skipped++;
    }
    await audit({
      action: 'MESSAGE_SENT',
      actorId: actor.id,
      actorRole: actor.role,
      metadata: { scope: d.scope, sent, skipped },
    });
    return ok(
      `Mensagem enviada para ${sent} paciente(s)${skipped ? ` (${skipped} ignorado(s): sem e-mail, sem consentimento ou erro)` : ''}.`,
      { sent, skipped },
    );
  });
}
