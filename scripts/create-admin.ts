/* eslint-disable no-console */
/**
 * Cria (ou redefine a senha de) uma conta ADMIN pela linha de comando.
 * A conta de administradora NUNCA é criada por cadastro público.
 *
 *   npm run admin:create -- --email=voce@exemplo.com --name="Dra. Fulana" --password="SenhaForte123"
 *   (sem --password, será pedida uma senha forte aleatória e exibida UMA vez)
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const email = arg('email')?.toLowerCase();
  const name = arg('name') ?? 'Psicóloga';
  const role = (arg('role') ?? 'ADMIN').toUpperCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe --email=... válido.');
  if (!['ADMIN', 'SECRETARIA'].includes(role))
    throw new Error('--role deve ser ADMIN ou SECRETARIA.');

  let password = arg('password');
  const generated = !password;
  if (!password) password = `${randomBytes(6).toString('base64url')}a1`;
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('A senha precisa ter ao menos 8 caracteres, com letras e números.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: role as 'ADMIN' | 'SECRETARIA',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      role: role as 'ADMIN' | 'SECRETARIA',
      deletedAt: null,
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  console.log(`✔ Conta ${user.role} pronta: ${user.email}`);
  if (generated) console.log(`  Senha gerada (anote agora, não será exibida de novo): ${password}`);
}

main()
  .catch((e) => {
    console.error('Erro:', e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
