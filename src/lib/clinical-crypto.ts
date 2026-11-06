import { decrypt, encrypt } from './crypto';

/**
 * Selagem/abertura do conteúdo clínico. O `patientId` entra como AAD (dado autenticado
 * associado) – um texto cifrado copiado para a ficha de outro paciente falha na decifragem.
 */
export interface RecordPayload {
  title?: string;
  html: string;
}

export const sealRecord = (patientId: string, payload: RecordPayload) =>
  encrypt(JSON.stringify(payload), `record:${patientId}`);

export const openRecord = (patientId: string, enc: string): RecordPayload =>
  JSON.parse(decrypt(enc, `record:${patientId}`)) as RecordPayload;

export type AnamnesisData = Record<string, string>;

export const sealAnamnesis = (patientId: string, data: AnamnesisData) =>
  encrypt(JSON.stringify(data), `anamnesis:${patientId}`);

export const openAnamnesis = (patientId: string, enc: string): AnamnesisData =>
  JSON.parse(decrypt(enc, `anamnesis:${patientId}`)) as AnamnesisData;
