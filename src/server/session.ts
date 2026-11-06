import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { PatientProfile, Role, User } from '@prisma/client';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  can,
  ForbiddenError,
  isStaff,
  UnauthorizedError,
  type Permission,
} from '@/lib/permissions';

export type SessionUser = User & { patientProfile: PatientProfile | null };

/** Equipe (ADMIN/SECRETARIA) precisa autenticar de novo após 12 h; paciente fica 7 dias. */
const STAFF_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Usuário autenticado e VÁLIDO: confere no banco se não foi apagado e se a
 * `sessionVersion` do token ainda é a atual (permite "sair de todos os dispositivos").
 * Cacheado por requisição.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    include: { patientProfile: true },
  });
  if (!user || user.deletedAt) return null;
  if (user.sessionVersion !== session.user.sv) return null;
  return user;
});

/** Sessão de equipe vale 12 h desde o login (o JWT em si dura 7 dias para pacientes). */
async function staffSessionExpired(): Promise<boolean> {
  const session = await auth();
  const at = session?.user?.at;
  return !at || Date.now() - at > STAFF_MAX_AGE_MS;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar');
  return user;
}

/** Para Server Actions: lança em vez de redirecionar. */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(isStaff(user.role) ? '/admin' : '/paciente');
  return user;
}

/** Área do paciente: exige perfil PACIENTE com ficha vinculada. */
export async function requirePatient(): Promise<SessionUser & { patientProfile: PatientProfile }> {
  const user = await requireUser();
  if (user.role !== 'PACIENTE') redirect('/admin');
  if (!user.patientProfile || user.patientProfile.deletedAt) redirect('/entrar');
  return user as SessionUser & { patientProfile: PatientProfile };
}

/** Painel: exige permissão específica. Redireciona se for equipe sem a permissão. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) redirect('/paciente');
  if (await staffSessionExpired()) redirect('/entrar?expirada=1');
  if (!can(user.role, permission)) redirect('/admin');
  return user;
}

/** Variante para Server Actions e Route Handlers (lança erros tipados). */
export async function requirePermissionOrThrow(permission: Permission): Promise<SessionUser> {
  const user = await requireUserOrThrow();
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}

export async function requirePatientOrThrow(): Promise<
  SessionUser & { patientProfile: PatientProfile }
> {
  const user = await requireUserOrThrow();
  if (user.role !== 'PACIENTE' || !user.patientProfile || user.patientProfile.deletedAt) {
    throw new ForbiddenError();
  }
  return user as SessionUser & { patientProfile: PatientProfile };
}
