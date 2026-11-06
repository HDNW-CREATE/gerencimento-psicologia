import 'server-only';
import { db } from '@/lib/db';

const REQUIRED = ['TERMO_CONSENTIMENTO', 'POLITICA_PRIVACIDADE', 'TERMOS_DE_USO'] as const;

/** Versões vigentes dos documentos legais que o usuário ainda NÃO aceitou. */
export async function getPendingConsents(userId: string) {
  const latest = await Promise.all(
    REQUIRED.map((type) =>
      db.legalDocument.findFirst({ where: { type }, orderBy: { version: 'desc' } }),
    ),
  );
  const docs = latest.filter((d): d is NonNullable<typeof d> => !!d);
  if (docs.length === 0) return [];
  const accepted = await db.consentAcceptance.findMany({
    where: { userId, legalDocumentId: { in: docs.map((d) => d.id) } },
    select: { legalDocumentId: true },
  });
  const ok = new Set(accepted.map((a) => a.legalDocumentId));
  return docs.filter((d) => !ok.has(d.id));
}
