'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/ratelimit';
import { clinicSchema, getClinic, saveSetting } from '@/lib/settings';
import { deleteObject, EXT_BY_MIME, putObject, sniffMime } from '@/lib/storage';
import { fail, ok, run, UserError, type ActionResult } from '../action-result';
import { requirePermissionOrThrow } from '../session';

const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_DOC = 5 * 1024 * 1024;

async function readFile(formData: FormData, field: string, max: number) {
  const f = formData.get(field);
  if (!(f instanceof File) || f.size === 0) throw new UserError('Selecione um arquivo.');
  if (f.size > max)
    throw new UserError(`Arquivo muito grande (máximo ${Math.round(max / 1024 / 1024)} MB).`);
  const buf = Buffer.from(await f.arrayBuffer());
  const mime = sniffMime(buf); // tipo real, pelo conteúdo
  return { buf, mime, name: f.name };
}

/** Foto da psicóloga ou imagem de assinatura (públicas no site / usadas no recibo). */
export async function uploadClinicImageAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('settings.manage');
    const kind = z.enum(['photo', 'signature']).parse(formData.get('kind'));
    const { buf, mime } = await readFile(formData, 'file', MAX_IMAGE);
    if (!mime || mime === 'application/pdf') return fail('Envie uma imagem PNG, JPG ou WebP.');

    const key = `public/${kind}-${randomBytes(6).toString('hex')}.${EXT_BY_MIME[mime]}`;
    await putObject(key, buf, mime);

    const clinic = await getClinic();
    const old = kind === 'photo' ? clinic.photoKey : clinic.signatureKey;
    await saveSetting(
      'clinic',
      clinicSchema.parse({ ...clinic, [kind === 'photo' ? 'photoKey' : 'signatureKey']: key }),
    );
    if (old) await deleteObject(old).catch(() => undefined);

    await audit({
      action: 'SETTINGS_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Setting',
      entityId: `clinic.${kind}`,
    });
    revalidatePath('/', 'layout');
    return ok('Imagem atualizada.');
  });
}

/** Documento compartilhado com um paciente (atestado, declaração…). */
export async function uploadPatientDocumentAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('documents.manage');
    const rl = await rateLimit(`upload:${actor.id}`, 30, 60 * 60);
    if (!rl.allowed) return fail('Muitos envios seguidos. Aguarde um pouco.');

    const meta = z
      .object({
        patientId: z.string().min(1),
        title: z.string().trim().min(2, 'Informe um título.').max(120),
        kind: z.enum(['ATESTADO', 'DECLARACAO', 'RECIBO', 'OUTRO']),
        shared: z.enum(['true', 'false']).transform((v) => v === 'true'),
      })
      .parse({
        patientId: formData.get('patientId'),
        title: formData.get('title'),
        kind: formData.get('kind'),
        shared: formData.get('shared') ?? 'false',
      });

    const patient = await db.patientProfile.findFirst({
      where: { id: meta.patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new UserError('Paciente não encontrado.');

    const { buf, mime } = await readFile(formData, 'file', MAX_DOC);
    if (!mime) return fail('Formato não aceito. Envie PDF, PNG, JPG ou WebP.');

    // A chave nunca usa o nome enviado pelo usuário (evita path traversal e vazamento de dados no nome).
    const key = `documents/${patient.id}/${randomBytes(12).toString('hex')}.${EXT_BY_MIME[mime]}`;
    await putObject(key, buf, mime);
    const doc = await db.document.create({
      data: {
        patientId: patient.id,
        uploadedById: actor.id,
        kind: meta.kind,
        title: meta.title,
        storageKey: key,
        mimeType: mime,
        sizeBytes: buf.length,
        sharedWithPatient: meta.shared,
      },
    });
    await audit({
      action: 'DOCUMENT_UPLOAD',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Document',
      entityId: doc.id,
      metadata: { shared: meta.shared },
    });
    revalidatePath('/admin', 'layout');
    return ok('Documento enviado.');
  });
}

export async function updateDocumentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('documents.manage');
    const d = z.object({ id: z.string(), shared: z.boolean() }).parse(input);
    await db.document.update({ where: { id: d.id }, data: { sharedWithPatient: d.shared } });
    await audit({
      action: 'DOCUMENT_UPLOAD',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Document',
      entityId: d.id,
      metadata: { shared: d.shared },
    });
    revalidatePath('/admin', 'layout');
    revalidatePath('/paciente', 'layout');
    return ok(
      d.shared
        ? 'Documento compartilhado com o paciente.'
        : 'Documento não está mais visível ao paciente.',
    );
  });
}

export async function deleteDocumentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('documents.manage');
    const { id } = z.object({ id: z.string() }).parse(input);
    // Exclusão lógica; o arquivo permanece no armazenamento para fins de auditoria/guarda
    await db.document.update({
      where: { id },
      data: { deletedAt: new Date(), sharedWithPatient: false },
    });
    await audit({
      action: 'DOCUMENT_DELETE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Document',
      entityId: id,
    });
    revalidatePath('/admin', 'layout');
    revalidatePath('/paciente', 'layout');
    return ok('Documento removido.');
  });
}
