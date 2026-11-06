import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { EMAIL_TEMPLATE_DEFAULTS } from '@/lib/defaults';
import type { Role } from '@prisma/client';
import type { SessionUser } from '@/server/session';

/** Esvazia TODAS as tabelas (TRUNCATE não dispara os gatilhos anti-DELETE do prontuário). */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Dados mínimos: serviço, horários seg–sex 9–12/14–18, templates. Aprovação automática por padrão. */
export async function baseFixtures(opts: { manualApproval?: boolean; maxFuture?: number } = {}) {
  const service = await db.serviceType.create({
    data: { name: 'Terapia individual', durationMinutes: 50, priceCents: 20000 },
  });
  for (const weekday of [1, 2, 3, 4, 5]) {
    await db.availabilityRule.createMany({
      data: [
        { weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
        { weekday, startMinute: 14 * 60, endMinute: 18 * 60 },
      ],
    });
  }
  for (const t of EMAIL_TEMPLATE_DEFAULTS) await db.emailTemplate.create({ data: t });
  await db.setting.create({
    data: {
      key: 'scheduling',
      value: {
        manualApproval: opts.manualApproval ?? false,
        maxFutureAppointments: opts.maxFuture ?? 3,
        minAdvanceHours: 12,
        minCancelHours: 24,
      },
    },
  });
  return { service };
}

export async function makeUser(
  email: string,
  opts: { role?: Role; verified?: boolean; name?: string } = {},
): Promise<SessionUser> {
  const role = opts.role ?? 'PACIENTE';
  const user = await db.user.create({
    data: {
      email,
      name: opts.name ?? email.split('@')[0]!,
      role,
      passwordHash: await bcrypt.hash('Senha1234', 4),
      emailVerifiedAt: opts.verified === false ? null : new Date(),
      ...(role === 'PACIENTE'
        ? { patientProfile: { create: { fullName: opts.name ?? email.split('@')[0]!, email } } }
        : {}),
    },
    include: { patientProfile: true },
  });
  return user;
}
