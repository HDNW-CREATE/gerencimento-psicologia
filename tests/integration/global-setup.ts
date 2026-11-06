import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

/**
 * Cria (se preciso) o banco de testes e aplica as migrations.
 * Usa TEST_DATABASE_URL; NUNCA toca no DATABASE_URL de desenvolvimento/produção.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL (um banco DEDICADO a testes).');
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error('Por segurança, o nome do banco de testes deve conter "test".');
  }
  const u = new URL(url);
  const dbName = u.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    const exists = await admin.$queryRawUnsafe<{ n: number }[]>(
      `SELECT 1 AS n FROM pg_database WHERE datname = '${dbName}'`,
    );
    if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
