import { db } from './db';
import { getClientIp } from './request';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Rate limit em janela fixa, guardado no PostgreSQL (funciona em serverless, sem Redis).
 * Operação atômica: um único INSERT … ON CONFLICT … DO UPDATE com RETURNING.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count"     = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;

  const row = rows[0]!;
  const retryAfterSeconds = Math.max(0, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
  return {
    allowed: row.count <= limit,
    remaining: Math.max(0, limit - row.count),
    retryAfterSeconds,
  };
}

/** Atalho: limita por IP + escopo (login, cadastro, etc.). */
export async function rateLimitByIp(scope: string, limit: number, windowSeconds: number) {
  const ip = await getClientIp();
  return rateLimit(`${scope}:ip:${ip}`, limit, windowSeconds);
}

export function rateLimitMessage(r: RateLimitResult): string {
  const min = Math.max(1, Math.ceil(r.retryAfterSeconds / 60));
  return `Muitas tentativas. Aguarde ${min} minuto${min > 1 ? 's' : ''} e tente novamente.`;
}

/** Limpeza de linhas vencidas (chamada pelo cron). */
export async function purgeExpiredRateLimits() {
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
