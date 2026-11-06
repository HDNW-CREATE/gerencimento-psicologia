import { headers } from 'next/headers';

/** IP do cliente (a Vercel preenche x-forwarded-for / x-real-ip). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  return ip.slice(0, 64);
}

export async function getUserAgent(): Promise<string | undefined> {
  const h = await headers();
  return h.get('user-agent')?.slice(0, 255) ?? undefined;
}
