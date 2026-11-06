import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

/** Prepara o banco de testes: migrations + base limpa (admin, termos, serviços, horários). */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL (banco dedicado a testes).');
  if (!/test/i.test(new URL(url).pathname))
    throw new Error('O banco de testes deve ter "test" no nome.');

  const env = {
    ...process.env,
    DATABASE_URL: url,
    SEED_DEMO_DATA: 'false',
    SEED_ADMIN_EMAIL: 'admin@consultorio.local',
    SEED_ADMIN_PASSWORD: 'Troque123senha',
  };
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env });

  const db = new PrismaClient({ datasources: { db: { url } } });
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  await db.$disconnect();

  execSync('npx tsx prisma/seed.ts', { stdio: 'pipe', env });
  rmSync(path.join(process.cwd(), '.dev-mail'), { recursive: true, force: true });
}
