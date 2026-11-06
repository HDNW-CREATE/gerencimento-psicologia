import 'server-only';
import type { AssistantState, AssistantTurn } from '@/lib/assistant/types';
import { isStaff } from '@/lib/permissions';
import type { SessionUser } from '../session';
import { handlePatientMessage } from './patient';
import { handleStaffMessage } from './staff';

const MAX_LEN = 500;

/**
 * Ponto único de entrada da Aurora. O PAPEL vem sempre da sessão do servidor:
 *  • ADMIN / SECRETARIA → respostas e ações da equipe (cada ação confere a permissão);
 *  • PACIENTE → respostas restritas aos dados do próprio paciente.
 * O `state` do cliente só carrega o andamento de uma conversa (passo e campos digitados) —
 * não concede nenhuma permissão e tudo é revalidado antes de gravar.
 */
export async function handleAssistantMessage(
  actor: SessionUser,
  input: { text: string; state: AssistantState },
): Promise<AssistantTurn & { saved?: boolean }> {
  const text = input.text.replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  if (!text) return { replies: [{ text: 'Pode escrever a sua pergunta. 🙂' }], state: input.state };

  if (isStaff(actor.role)) return handleStaffMessage(actor, text, input.state);

  if (actor.role === 'PACIENTE' && actor.patientProfile && !actor.patientProfile.deletedAt) {
    // O paciente nunca executa fluxos de cadastro: o estado é descartado.
    return handlePatientMessage(
      actor as SessionUser & { patientProfile: NonNullable<SessionUser['patientProfile']> },
      text,
    );
  }
  return { replies: [{ text: 'Não foi possível identificar o seu cadastro.' }], state: null };
}
