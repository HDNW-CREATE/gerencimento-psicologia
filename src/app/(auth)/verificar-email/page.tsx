import type { Metadata } from 'next';
import { VerifyButton } from './verify-button';

export const metadata: Metadata = { title: 'Confirmar e-mail', robots: { index: false } };

/**
 * A confirmação só acontece quando a pessoa CLICA no botão (POST). Assim, scanners de
 * e-mail que "visitam" links automaticamente não consomem o token.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <VerifyButton token={token ?? ''} />;
}
