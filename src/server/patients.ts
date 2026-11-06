import 'server-only';
import type { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { can } from '@/lib/permissions';
import { patientSchema } from '@/lib/schemas/patient';
import { parseMoneyToCents } from '@/lib/validators';
import { ForbiddenError } from '@/lib/permissions';
import { UserError } from './action-result';
import type { SessionUser } from './session';

/** Erros de unicidade (CPF) viram mensagem amigável. */
export function mapUnique(err: unknown): never {
  if ((err as { code?: string }).code === 'P2002') {
    throw new UserError('Já existe um paciente com este CPF.', { cpf: ['CPF já cadastrado.'] });
  }
  throw err;
}

export function toPatientData(d: z.output<typeof patientSchema>) {
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

/**
 * Cadastro de paciente — ÚNICO caminho de criação usado pelo formulário e pela assistente (chat).
 * Valida com o mesmo schema, exige `patients.write` e registra auditoria.
 */
export async function createPatientRecord(
  actor: SessionUser,
  raw: unknown,
  via: 'form' | 'assistant' = 'form',
) {
  if (!can(actor.role, 'patients.write')) throw new ForbiddenError();
  const data = toPatientData(patientSchema.parse(raw));
  const p = await db.patientProfile.create({ data }).catch(mapUnique);
  await audit({
    action: 'PATIENT_CREATE',
    actorId: actor.id,
    actorRole: actor.role,
    entity: 'PatientProfile',
    entityId: p.id,
    metadata: { via },
  });
  return p;
}
