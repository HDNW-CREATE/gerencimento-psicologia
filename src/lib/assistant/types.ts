/** Tipos compartilhados entre o widget (cliente) e o motor da assistente (servidor). */

export const ASSISTANT_NAME = 'Aurora';

export interface AssistantLink {
  label: string;
  /** Somente caminhos internos (começam com "/"). */
  href: string;
}

export interface AssistantReply {
  /** Texto simples; "**negrito**" e quebras de linha são suportados. Nunca HTML. */
  text: string;
  links?: AssistantLink[];
  /** Sugestões de resposta rápida (botões). */
  quick?: string[];
}

export type RegisterStep =
  'name' | 'phone' | 'email' | 'birth' | 'guardianName' | 'guardianPhone' | 'confirm' | 'duplicate';

/** `undefined` = ainda não perguntado · `null` = a pessoa escolheu pular. */
export interface RegisterData {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  birthDate?: string | null; // YYYY-MM-DD
  cpf?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
}

export type AssistantState = { flow: 'register'; step: RegisterStep; data: RegisterData } | null;

export interface AssistantTurn {
  replies: AssistantReply[];
  state: AssistantState;
}
