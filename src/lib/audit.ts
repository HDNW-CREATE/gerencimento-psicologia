import type { Prisma, Role } from '@prisma/client';
import { db } from './db';
import { getClientIp, getUserAgent } from './request';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGIN_LOCKED'
  | 'LOGOUT_ALL'
  | 'REGISTER'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_DONE'
  | 'PASSWORD_CHANGED'
  | 'APPOINTMENT_CREATE'
  | 'APPOINTMENT_UPDATE'
  | 'APPOINTMENT_CANCEL'
  | 'APPOINTMENT_RESCHEDULE'
  | 'APPOINTMENT_STATUS'
  | 'PATIENT_CREATE'
  | 'PATIENT_UPDATE'
  | 'PATIENT_DELETE'
  | 'CLINICAL_RECORD_READ'
  | 'CLINICAL_RECORD_CREATE'
  | 'CLINICAL_RECORD_UPDATE'
  | 'CLINICAL_RECORD_RETRACT'
  | 'CLINICAL_RECORD_EXPORT'
  | 'ANAMNESIS_READ'
  | 'ANAMNESIS_UPDATE'
  | 'PAYMENT_UPDATE'
  | 'PACKAGE_CREATE'
  | 'RECEIPT_ISSUED'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_DOWNLOAD'
  | 'DOCUMENT_DELETE'
  | 'SETTINGS_UPDATE'
  | 'SITE_CONTENT_UPDATE'
  | 'LEGAL_DOCUMENT_PUBLISH'
  | 'DATA_REQUEST_CREATE'
  | 'DATA_REQUEST_UPDATE'
  | 'DATA_EXPORT'
  | 'AVAILABILITY_UPDATE'
  | 'MESSAGE_SENT'
  | 'REPORT_EXPORT';

export interface AuditInput {
  action: AuditAction;
  actorId?: string | null;
  actorRole?: Role | null;
  entity?: string;
  entityId?: string;
  /** NUNCA inclua senhas, tokens ou conteúdo de prontuário aqui. */
  metadata?: Record<string, unknown>;
}

const FORBIDDEN_KEYS = /pass|token|secret|content|texto|anamnese|hash|cpf/i;

/** Remove qualquer chave suspeita de carregar dado sensível (defesa em profundidade). */
function sanitizeMetadata(meta?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!meta) return undefined;
  const clean: Record<string, Prisma.InputJsonValue> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    if (v === undefined) continue;
    if (typeof v === 'string') clean[k] = v.slice(0, 300);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) clean[k] = v as never;
    else clean[k] = JSON.stringify(v).slice(0, 500);
  }
  return clean;
}

/**
 * Registra um evento de auditoria. Nunca lança erro: falha de log não pode derrubar a operação,
 * mas é reportada em console.error (sem dados sensíveis).
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    let ip: string | undefined;
    let userAgent: string | undefined;
    try {
      ip = await getClientIp();
      userAgent = await getUserAgent();
    } catch {
      // fora de um contexto de requisição (cron/seed) – sem IP
    }
    await db.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        entity: input.entity,
        entityId: input.entityId,
        ip,
        userAgent,
        metadata: sanitizeMetadata(input.metadata),
      },
    });
  } catch (err) {
    console.error('[audit] falha ao gravar log', (err as Error).message);
  }
}
