import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

/**
 * Armazenamento de arquivos com dois drivers:
 *  • "s3"    – Cloudflare R2 / Supabase Storage / AWS S3 (produção). Download por URL assinada e curta.
 *  • "local" – pasta `.uploads/` (SOMENTE desenvolvimento).
 * O bucket deve ser PRIVADO. Arquivos nunca são acessados diretamente pelo navegador sem passar
 * pela rota autenticada (/api/documents/[id]) ou, no caso de imagens do site, por /api/public/*.
 */

let s3: S3Client | undefined;
function client(): S3Client {
  const e = env();
  if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      'Armazenamento S3 não configurado (S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY).',
    );
  }
  s3 ??= new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT || undefined,
    forcePathStyle: !!e.S3_ENDPOINT,
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
  });
  return s3;
}

const localRoot = () => path.join(process.cwd(), '.uploads');

/** Impede path traversal em chaves vindas do banco/rota. */
function safeKey(key: string): string {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new Error('Chave de arquivo inválida');
  }
  return key;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  safeKey(key);
  if (env().STORAGE_DRIVER === 's3') {
    await client().send(
      new PutObjectCommand({
        Bucket: env().S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const file = path.join(localRoot(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  safeKey(key);
  try {
    if (env().STORAGE_DRIVER === 's3') {
      const res = await client().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    }
    return await readFile(path.join(localRoot(), key));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  safeKey(key);
  if (env().STORAGE_DRIVER === 's3') {
    await client().send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
    return;
  }
  await unlink(path.join(localRoot(), key)).catch(() => undefined);
}

/** URL assinada de curta duração (somente driver s3). Em "local", retorna null → a rota faz streaming. */
export async function presignedDownloadUrl(
  key: string,
  filename: string,
  expiresSeconds = 60,
): Promise<string | null> {
  safeKey(key);
  if (env().STORAGE_DRIVER !== 's3') return null;
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: env().S3_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/[^\w.\- ]/g, '_')}"`,
    }),
    { expiresIn: expiresSeconds },
  );
}

/** Detecta o tipo real pelo conteúdo (não confia no nome/Content-Type enviado). */
export function sniffMime(
  buf: Buffer,
): 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
