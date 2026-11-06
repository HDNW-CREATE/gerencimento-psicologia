import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { can } from '@/lib/permissions';
import { rateLimit } from '@/lib/ratelimit';
import { getObject, presignedDownloadUrl } from '@/lib/storage';
import { getCurrentUser } from '@/server/session';

/**
 * Download autenticado de documentos.
 *  • PACIENTE: somente documentos DELE e marcados como compartilhados.
 *  • Equipe com permissão `documents.manage`: qualquer documento não excluído.
 * Em produção (S3) redireciona para URL assinada de 60 s; em desenvolvimento faz streaming.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Não autorizado', { status: 401 });

  const rl = await rateLimit(`doc-dl:${user.id}`, 60, 60);
  if (!rl.allowed) return new NextResponse('Muitas requisições', { status: 429 });

  const { id } = await ctx.params;
  const doc = await db.document.findFirst({ where: { id, deletedAt: null } });
  // 404 igual para "não existe" e "não é seu" (não revela a existência de documentos alheios)
  if (!doc) return new NextResponse('Não encontrado', { status: 404 });

  const isOwner =
    user.role === 'PACIENTE' && user.patientProfile?.id === doc.patientId && doc.sharedWithPatient;
  const isStaff = can(user.role, 'documents.manage');
  if (!isOwner && !isStaff) return new NextResponse('Não encontrado', { status: 404 });

  await audit({
    action: 'DOCUMENT_DOWNLOAD',
    actorId: user.id,
    actorRole: user.role,
    entity: 'Document',
    entityId: doc.id,
  });

  const ext = doc.mimeType === 'application/pdf' ? 'pdf' : doc.mimeType.split('/')[1];
  const filename = `${doc.title}.${ext}`;
  const url = await presignedDownloadUrl(doc.storageKey, filename);
  if (url) return NextResponse.redirect(url, 302);

  const buf = await getObject(doc.storageKey);
  if (!buf) return new NextResponse('Arquivo indisponível', { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
