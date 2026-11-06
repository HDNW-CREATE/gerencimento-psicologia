'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { patientSchema, quickPatientSchema } from '@/lib/schemas/patient';
import { parseMoneyToCents } from '@/lib/validators';
import { ok, run, UserError, type ActionResult } from '../action-result';
import { requirePermissionOrThrow } from '../session';

/** Erros de unicidade (CPF) viram mensagem amigável. */
function mapUnique(err: unknown): never {
  if ((err as { code?: string }).code === 'P2002') {
    throw new UserError('Já existe um paciente com este CPF.', { cpf: ['CPF já cadastrado.'] });
  }
  throw err;
}

export async function quickCreatePatientAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('patients.write');
    const d = quickPatientSchema.parse(input);
    const p = await db.patientProfile.create({ data: d }).catch(mapUnique);
    await audit({
      action: 'PATIENT_CREATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'PatientProfile',
      entityId: p.id,
      metadata: { quick: true },
    });
    revalidatePath('/admin', 'layout');
    return ok('Paciente cadastrado.', { id: p.id, name: p.fullName });
  });
}

function toData(d: z.output<typeof patientSchema>) {
  let customPriceCents: number | null = null;
  if (d.customPrice) {
    const c = parseMoneyToCents(d.customPrice);
    if (c === null)
      throw new UserError('Valor personalizado inválido.', { customPrice: ['Valor inválido.'] });
    customPriceCents = c;
  }
  const { customPrice: _ignored, birthDate, ...rest } = d;
  return {
    ...rest,
    birthDate: birthDate ? new Date(`${birthDate}T00:00:00Z`) : null,
    customPriceCents,
  };
}

export async function createPatientAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('patients.write');
    const d = toData(patientSchema.parse(input));
    const p = await db.patientProfile.create({ data: d }).catch(mapUnique);
    await audit({
      action: 'PATIENT_CREATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'PatientProfile',
      entityId: p.id,
    });
    revalidatePath('/admin', 'layout');
    return ok('Paciente cadastrado.', { id: p.id });
  });
}

export async function updatePatientAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('patients.write');
    const { id, ...rest } = z.object({ id: z.string() }).passthrough().parse(input);
    const d = toData(patientSchema.parse(rest));
    const exists = await db.patientProfile.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new UserError('Paciente não encontrado.');
    await db.patientProfile.update({ where: { id }, data: d }).catch(mapUnique);
    await audit({
      action: 'PATIENT_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'PatientProfile',
      entityId: id,
    });
    revalidatePath('/admin', 'layout');
    return ok('Dados salvos.');
  });
}

export async function setPatientStatusAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('patients.write');
    const { id, status } = z
      .object({ id: z.string(), status: z.enum(['ATIVO', 'INATIVO', 'ALTA']) })
      .parse(input);
    await db.patientProfile.update({ where: { id }, data: { status } });
    await audit({
      action: 'PATIENT_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'PatientProfile',
      entityId: id,
      metadata: { status },
    });
    revalidatePath('/admin', 'layout');
    return ok('Status atualizado.');
  });
}

/** "Excluir" = arquivar (soft delete). Prontuário e financeiro permanecem preservados. */
export async function archivePatientAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('patients.write');
    const { id } = z.object({ id: z.string() }).parse(input);
    const future = await db.appointment.count({
      where: {
        patientId: id,
        deletedAt: null,
        status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
        startsAt: { gt: new Date() },
      },
    });
    if (future > 0)
      throw new UserError(
        'Este paciente tem sessões futuras em aberto. Cancele-as antes de arquivar.',
      );
    await db.patientProfile.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INATIVO' },
    });
    await audit({
      action: 'PATIENT_DELETE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'PatientProfile',
      entityId: id,
      metadata: { soft: true },
    });
    revalidatePath('/admin', 'layout');
    return ok('Paciente arquivado.');
  });
}
