'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { AssistantTurn } from '@/lib/assistant/types';
import { rateLimit, rateLimitMessage } from '@/lib/ratelimit';
import { fail, ok, run, type ActionResult } from '../action-result';
import { handleAssistantMessage } from '../assistant/engine';
import { requireUserOrThrow } from '../session';

const nullableStr = z.string().max(300).nullable().optional();
const dataSchema = z
  .object({
    fullName: nullableStr,
    phone: nullableStr,
    email: nullableStr,
    birthDate: nullableStr,
    cpf: nullableStr,
    guardianName: nullableStr,
    guardianPhone: nullableStr,
  })
  .strict();

const inputSchema = z.object({
  text: z.string().max(1000),
  state: z
    .object({
      flow: z.literal('register'),
      step: z.enum([
        'name',
        'phone',
        'email',
        'birth',
        'guardianName',
        'guardianPhone',
        'confirm',
        'duplicate',
      ]),
      data: dataSchema,
    })
    .nullable(),
});

/**
 * Mensagem para a Aurora. O texto da conversa NÃO é gravado em log nem no banco
 * (pode conter dados de pessoas); só ações concretas (ex.: cadastro) geram auditoria.
 */
export async function assistantMessageAction(input: unknown): Promise<ActionResult<AssistantTurn>> {
  return run<AssistantTurn>(async () => {
    const user = await requireUserOrThrow();
    const rl = await rateLimit(`assistant:${user.id}`, 60, 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) return fail('Mensagem inválida.');

    const { saved, ...turn } = await handleAssistantMessage(
      user,
      parsed.data as Parameters<typeof handleAssistantMessage>[1],
    );
    if (saved) revalidatePath('/admin', 'layout');
    return ok(undefined, turn);
  });
}
