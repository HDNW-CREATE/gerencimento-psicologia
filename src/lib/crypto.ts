import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { env } from './env';

/**
 * Criptografia em nível de aplicação para o prontuário (AES-256-GCM).
 * Formato armazenado:  v1:<iv base64>:<authTag base64>:<ciphertext base64>
 * O prefixo "v1" permite rotacionar a chave/algoritmo no futuro sem perder dados.
 */
const VERSION = 'v1';

function key(): Buffer {
  return Buffer.from(env().CLINICAL_ENCRYPTION_KEY, 'base64');
}

export function encrypt(plaintext: string, aad?: string): string {
  const iv = randomBytes(12); // 96 bits, recomendado para GCM
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  // AAD amarra o texto cifrado ao registro (impede copiar o cifrado de um paciente para outro).
  if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(payload: string, aad?: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error('Formato de dado criptografado inválido');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
  return pt.toString('utf8');
}

/** Token aleatório URL-safe (enviado ao usuário) + seu hash (guardado no banco). */
export function generateToken(bytes = 32): { token: string; hash: string } {
  const token = randomBytes(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação em tempo constante (para segredos como CRON_SECRET). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
