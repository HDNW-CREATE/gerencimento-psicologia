'use server';

import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/request';
import { ok, run, type ActionResult } from '../action-result';
import { getPendingConsents } from '../consents';
import { requireUserOrThrow } from '../session';

/** Registra o aceite (data/hora, versão, IP) das versões vigentes ainda não aceitas. */
export async function acceptPendingConsentsAction(): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUserOrThrow();
    const pending = await getPendingConsents(user.id);
    const ip = await getClientIp();
    const userAgent = await getUserAgent();
    if (pending.length) {
      await db.consentAcceptance.createMany({
        data: pending.map((d) => ({ userId: user.id, legalDocumentId: d.id, ip, userAgent })),
      });
      await audit({
        action: 'REGISTER',
        actorId: user.id,
        actorRole: user.role,
        metadata: { reconsent: pending.length },
      });
    }
    return ok('Obrigado! Aceite registrado.');
  });
}
