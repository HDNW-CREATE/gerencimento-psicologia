import { NextResponse } from 'next/server';
import { getObject, sniffMime } from '@/lib/storage';

/**
 * Serve APENAS imagens do site público (chaves que começam com "public/").
 * Qualquer outra chave (documentos de pacientes) é recusada aqui.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const full = key.join('/');
  if (!full.startsWith('public/') && key[0] !== 'public') {
    return new NextResponse('Not found', { status: 404 });
  }
  const objectKey = full.startsWith('public/') ? full : `public/${full}`;
  const buf = await getObject(objectKey);
  if (!buf) return new NextResponse('Not found', { status: 404 });
  const mime = sniffMime(buf);
  if (!mime || mime === 'application/pdf') return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
