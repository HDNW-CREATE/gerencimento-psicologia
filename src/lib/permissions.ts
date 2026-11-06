import type { Role } from '@prisma/client';

/**
 * Matriz ÚNICA de permissões. Todo serviço do servidor consulta `can()`.
 * O prontuário (clinical.*) é exclusivo da ADMIN: SECRETARIA e PACIENTE nunca têm acesso.
 */
export type Permission =
  | 'agenda.manage'
  | 'patients.read'
  | 'patients.write'
  | 'finance.manage'
  | 'clinical.read'
  | 'clinical.write'
  | 'documents.manage'
  | 'communication.send'
  | 'settings.manage'
  | 'site.manage'
  | 'audit.read'
  | 'lgpd.manage';

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([
    'agenda.manage',
    'patients.read',
    'patients.write',
    'finance.manage',
    'clinical.read',
    'clinical.write',
    'documents.manage',
    'communication.send',
    'settings.manage',
    'site.manage',
    'audit.read',
    'lgpd.manage',
  ]),
  SECRETARIA: new Set<Permission>([
    'agenda.manage',
    'patients.read',
    'patients.write',
    'finance.manage',
    'communication.send',
  ]),
  PACIENTE: new Set<Permission>([]),
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].has(permission);
}

/** Perfis que podem entrar no painel /admin (parte das telas é filtrada por `can`). */
export function isStaff(role: Role | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SECRETARIA';
}

export class ForbiddenError extends Error {
  constructor(message = 'Você não tem permissão para esta ação.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Faça login para continuar.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
