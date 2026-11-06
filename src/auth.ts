import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { audit } from './lib/audit';
import { db } from './lib/db';
import { rateLimit } from './lib/ratelimit';
import { getClientIp } from './lib/request';

/** Erros com `code` para a tela de login mostrar a mensagem certa (sem revelar se o e-mail existe). */
export class RateLimitedError extends CredentialsSignin {
  code = 'rate_limited';
}
export class InvalidLoginError extends CredentialsSignin {
  code = 'invalid_credentials';
}

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

// Hash válido gerado uma vez (lazy) e usado quando o e-mail não existe: iguala o tempo de resposta (anti-enumeração).
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync('nao-existe-usuario', 12));

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLoginError();
        const { email, password } = parsed.data;
        const ip = await getClientIp();

        // Rate limit por IP e por e-mail (janela de 15 min)
        const [byIp, byEmail] = await Promise.all([
          rateLimit(`login:ip:${ip}`, 20, 15 * 60),
          rateLimit(`login:email:${email}`, 10, 15 * 60),
        ]);
        if (!byIp.allowed || !byEmail.allowed) {
          await audit({ action: 'LOGIN_LOCKED', metadata: { reason: 'rate_limit' } });
          throw new RateLimitedError();
        }

        const user = await db.user.findUnique({ where: { email } });
        const now = new Date();

        if (!user || user.deletedAt) {
          await bcrypt.compare(password, getDummyHash());
          await audit({ action: 'LOGIN_FAILURE', metadata: { reason: 'unknown_user' } });
          throw new InvalidLoginError();
        }

        if (user.lockedUntil && user.lockedUntil > now) {
          await audit({ action: 'LOGIN_LOCKED', actorId: user.id, actorRole: user.role });
          throw new RateLimitedError();
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const failures = user.failedLoginCount + 1;
          const lock = failures >= MAX_FAILURES;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: lock ? 0 : failures,
              lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
            },
          });
          await audit({
            action: lock ? 'LOGIN_LOCKED' : 'LOGIN_FAILURE',
            actorId: user.id,
            actorRole: user.role,
            metadata: { reason: 'bad_password' },
          });
          throw new InvalidLoginError();
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
        });
        await audit({ action: 'LOGIN_SUCCESS', actorId: user.id, actorRole: user.role });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          sv: user.sessionVersion,
        };
      },
    }),
  ],
});
