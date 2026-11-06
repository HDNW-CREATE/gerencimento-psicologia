import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';
import { env } from '@/lib/env';
import { housekeeping, sendDueReminders, sendPaymentNotices } from '@/server/reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Chamado a cada ~15 min por um agendador (GitHub Actions / cron-job.org / Vercel Cron).
 * Autenticação: `Authorization: Bearer <CRON_SECRET>` (a Vercel envia isso automaticamente).
 */
async function handle(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 503 });

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const now = new Date();
  const reminders = await sendDueReminders(now);
  // Avisos de pagamento e limpeza rodam no máximo 1x/hora (minuto < 15)
  let paymentNotices = 0;
  if (now.getUTCMinutes() < 15) {
    paymentNotices = await sendPaymentNotices(now);
    await housekeeping(now);
  }
  return NextResponse.json({ ok: true, ...reminders, paymentNotices });
}

export const GET = handle;
export const POST = handle;
