'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ok, run, type ActionResult } from '../action-result';
import { amendRecord, createRecord, retractRecord, saveAnamnesis } from '../clinical';

/** Tamanho máximo do HTML aceito do editor (defesa adicional ao sanitize). */
const html = z.string().min(1, 'Escreva o conteúdo.').max(100_000);

export async function createRecordAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const d = z
      .object({
        patientId: z.string().min(1),
        appointmentId: z.string().optional().or(z.literal('')),
        title: z.string().trim().max(120).optional(),
        html,
      })
      .parse(input);
    const id = await createRecord({ ...d, appointmentId: d.appointmentId || undefined });
    revalidatePath(`/admin/pacientes/${d.patientId}/prontuario`);
    return ok('Evolução registrada (criptografada).', { id });
  });
}

export async function amendRecordAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const d = z
      .object({
        recordId: z.string(),
        patientId: z.string(),
        title: z.string().trim().max(120).optional(),
        html,
        reason: z.string().trim().min(3, 'Informe o motivo.').max(300),
      })
      .parse(input);
    await amendRecord(d);
    revalidatePath(`/admin/pacientes/${d.patientId}/prontuario`);
    return ok('Registro retificado. A versão anterior foi preservada no histórico.');
  });
}

export async function retractRecordAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const d = z
      .object({
        recordId: z.string(),
        patientId: z.string(),
        reason: z.string().trim().min(3, 'Informe o motivo.').max(300),
      })
      .parse(input);
    await retractRecord(d);
    revalidatePath(`/admin/pacientes/${d.patientId}/prontuario`);
    return ok('Registro invalidado (permanece no histórico).');
  });
}

export async function saveAnamnesisAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const d = z
      .object({ patientId: z.string(), data: z.record(z.string(), z.string().max(10_000)) })
      .parse(input);
    await saveAnamnesis(d.patientId, d.data);
    revalidatePath(`/admin/pacientes/${d.patientId}/prontuario`);
    return ok('Anamnese salva (criptografada).');
  });
}
