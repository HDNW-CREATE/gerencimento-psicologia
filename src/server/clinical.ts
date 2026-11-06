import 'server-only';
import { audit } from '@/lib/audit';
import {
  openAnamnesis,
  openRecord,
  sealAnamnesis,
  sealRecord,
  type AnamnesisData,
} from '@/lib/clinical-crypto';
import { db } from '@/lib/db';
import { sanitizeRichText } from '@/lib/sanitize';
import { UserError } from './action-result';
import { requirePermissionOrThrow } from './session';

/**
 * PRONTUÁRIO – regras de ouro deste módulo:
 *  1. TODA função começa exigindo `clinical.read/write` (só ADMIN). SECRETARIA e PACIENTE nunca passam.
 *  2. Conteúdo só existe em claro dentro destas funções; vai e volta criptografado (AES-256-GCM).
 *  3. Nada é apagado: retificar cria nova versão; invalidar só marca `retractedAt`.
 *  4. Toda leitura/escrita gera log de auditoria SEM o conteúdo.
 */

export interface RecordView {
  id: string;
  appointmentId: string | null;
  title: string;
  html: string;
  version: number;
  retractedAt: Date | null;
  retractedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  sessionDate: Date | null;
}

export interface RecordVersionView {
  version: number;
  title: string;
  html: string;
  reason: string | null;
  createdAt: Date;
  editedById: string;
}

function toView(
  r: {
    id: string;
    appointmentId: string | null;
    patientId: string;
    contentEnc: string;
    currentVersion: number;
    retractedAt: Date | null;
    retractedReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  sessionDate: Date | null,
): RecordView {
  const c = openRecord(r.patientId, r.contentEnc);
  return {
    id: r.id,
    appointmentId: r.appointmentId,
    title: c.title ?? '',
    html: sanitizeRichText(c.html),
    version: r.currentVersion,
    retractedAt: r.retractedAt,
    retractedReason: r.retractedReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sessionDate,
  };
}

export async function listRecords(patientId: string): Promise<RecordView[]> {
  const actor = await requirePermissionOrThrow('clinical.read');
  const rows = await db.clinicalRecord.findMany({
    where: { patientId },
    include: { appointment: { select: { startsAt: true } } },
    orderBy: { createdAt: 'desc' },
  });
  await audit({
    action: 'CLINICAL_RECORD_READ',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'PatientProfile',
    entityId: patientId,
    metadata: { count: rows.length },
  });
  return rows.map((r) => toView(r, r.appointment?.startsAt ?? null));
}

export async function getRecordVersions(recordId: string): Promise<RecordVersionView[]> {
  const actor = await requirePermissionOrThrow('clinical.read');
  const rec = await db.clinicalRecord.findUnique({
    where: { id: recordId },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (!rec) throw new UserError('Registro não encontrado.');
  await audit({
    action: 'CLINICAL_RECORD_READ',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'ClinicalRecord',
    entityId: recordId,
    metadata: { history: true },
  });
  return rec.versions.map((v) => {
    const c = openRecord(rec.patientId, v.contentEnc);
    return {
      version: v.version,
      title: c.title ?? '',
      html: sanitizeRichText(c.html),
      reason: v.reason,
      createdAt: v.createdAt,
      editedById: v.editedById,
    };
  });
}

export async function createRecord(input: {
  patientId: string;
  appointmentId?: string;
  title?: string;
  html: string;
}) {
  const actor = await requirePermissionOrThrow('clinical.write');
  const html = sanitizeRichText(input.html);
  if (!html.replace(/<[^>]+>/g, '').trim()) throw new UserError('Escreva o conteúdo da evolução.');

  const patient = await db.patientProfile.findFirst({
    where: { id: input.patientId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw new UserError('Paciente não encontrado.');

  if (input.appointmentId) {
    const appt = await db.appointment.findFirst({
      where: { id: input.appointmentId, patientId: patient.id, deletedAt: null },
      include: { clinicalRecord: { select: { id: true } } },
    });
    if (!appt) throw new UserError('Sessão não encontrada para este paciente.');
    if (appt.clinicalRecord)
      throw new UserError('Esta sessão já possui um registro. Abra-o para retificar.');
  }

  const contentEnc = sealRecord(patient.id, { title: input.title?.trim() || undefined, html });
  const rec = await db.$transaction(async (tx) => {
    const r = await tx.clinicalRecord.create({
      data: {
        patientId: patient.id,
        appointmentId: input.appointmentId,
        authorId: actor.id,
        contentEnc,
      },
    });
    await tx.clinicalRecordVersion.create({
      data: { recordId: r.id, version: 1, contentEnc, editedById: actor.id },
    });
    return r;
  });
  await audit({
    action: 'CLINICAL_RECORD_CREATE',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'ClinicalRecord',
    entityId: rec.id,
  });
  return rec.id;
}

/** Retificação: sempre cria uma NOVA versão e exige o motivo. A versão anterior permanece intacta. */
export async function amendRecord(input: {
  recordId: string;
  title?: string;
  html: string;
  reason: string;
}) {
  const actor = await requirePermissionOrThrow('clinical.write');
  const reason = input.reason.trim();
  if (reason.length < 3) throw new UserError('Informe o motivo da retificação.');
  const html = sanitizeRichText(input.html);
  if (!html.replace(/<[^>]+>/g, '').trim()) throw new UserError('O conteúdo não pode ficar vazio.');

  await db.$transaction(async (tx) => {
    const rec = await tx.clinicalRecord.findUnique({ where: { id: input.recordId } });
    if (!rec) throw new UserError('Registro não encontrado.');
    if (rec.retractedAt)
      throw new UserError('Este registro foi invalidado e não pode mais ser alterado.');
    const contentEnc = sealRecord(rec.patientId, { title: input.title?.trim() || undefined, html });
    const next = rec.currentVersion + 1;
    await tx.clinicalRecordVersion.create({
      data: { recordId: rec.id, version: next, contentEnc, editedById: actor.id, reason },
    });
    await tx.clinicalRecord.update({
      where: { id: rec.id },
      data: { contentEnc, currentVersion: next },
    });
  });
  await audit({
    action: 'CLINICAL_RECORD_UPDATE',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'ClinicalRecord',
    entityId: input.recordId,
  });
}

/** "Invalidar" não apaga: apenas marca o registro como retratado (continua no histórico e no PDF). */
export async function retractRecord(input: { recordId: string; reason: string }) {
  const actor = await requirePermissionOrThrow('clinical.write');
  const reason = input.reason.trim();
  if (reason.length < 3) throw new UserError('Informe o motivo da invalidação.');
  const rec = await db.clinicalRecord.findUnique({
    where: { id: input.recordId },
    select: { id: true, retractedAt: true },
  });
  if (!rec) throw new UserError('Registro não encontrado.');
  if (rec.retractedAt) return;
  await db.clinicalRecord.update({
    where: { id: rec.id },
    data: { retractedAt: new Date(), retractedReason: reason.slice(0, 300) },
  });
  await audit({
    action: 'CLINICAL_RECORD_RETRACT',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'ClinicalRecord',
    entityId: rec.id,
  });
}

/* ───────────────────── Anamnese ───────────────────── */

export async function getAnamnesis(
  patientId: string,
): Promise<{ data: AnamnesisData; version: number; updatedAt: Date } | null> {
  const actor = await requirePermissionOrThrow('clinical.read');
  const a = await db.anamnesis.findUnique({ where: { patientId } });
  await audit({
    action: 'ANAMNESIS_READ',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'PatientProfile',
    entityId: patientId,
  });
  if (!a) return null;
  return {
    data: openAnamnesis(patientId, a.dataEnc),
    version: a.currentVersion,
    updatedAt: a.updatedAt,
  };
}

export async function saveAnamnesis(patientId: string, data: AnamnesisData) {
  const actor = await requirePermissionOrThrow('clinical.write');
  const patient = await db.patientProfile.findFirst({
    where: { id: patientId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw new UserError('Paciente não encontrado.');
  // Limita tamanho e remove HTML (campos são texto puro)
  const clean: AnamnesisData = {};
  for (const [k, v] of Object.entries(data)) {
    if (/^[a-z0-9_]{1,60}$/.test(k)) clean[k] = String(v ?? '').slice(0, 10_000);
  }
  const enc = sealAnamnesis(patientId, clean);
  await db.$transaction(async (tx) => {
    const existing = await tx.anamnesis.findUnique({ where: { patientId } });
    if (!existing) {
      const a = await tx.anamnesis.create({ data: { patientId, dataEnc: enc } });
      await tx.anamnesisVersion.create({
        data: { anamnesisId: a.id, version: 1, dataEnc: enc, editedById: actor.id },
      });
    } else {
      const next = existing.currentVersion + 1;
      await tx.anamnesisVersion.create({
        data: { anamnesisId: existing.id, version: next, dataEnc: enc, editedById: actor.id },
      });
      await tx.anamnesis.update({
        where: { id: existing.id },
        data: { dataEnc: enc, currentVersion: next },
      });
    }
  });
  await audit({
    action: 'ANAMNESIS_UPDATE',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'PatientProfile',
    entityId: patientId,
  });
}
