import { notFound } from 'next/navigation';
import type { ConsentType } from '@prisma/client';
import { LegalText } from '@/components/legal-text';
import { db } from '@/lib/db';
import { fmtDate } from '@/lib/format';

/** Página de documento legal (versão vigente). Conteúdo editável pelo painel. */
export async function LegalPage({ type }: { type: ConsentType }) {
  const doc = await db.legalDocument.findFirst({ where: { type }, orderBy: { version: 'desc' } });
  if (!doc) notFound();
  return (
    <article className="container max-w-3xl py-12">
      <h1 className="mb-2 text-4xl">{doc.title}</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Versão {doc.version} · publicada em {fmtDate(doc.publishedAt)}
      </p>
      <LegalText content={doc.content} />
    </article>
  );
}

export async function legalTitle(type: ConsentType) {
  const doc = await db.legalDocument.findFirst({
    where: { type },
    orderBy: { version: 'desc' },
    select: { title: true },
  });
  return doc?.title ?? 'Documento';
}
