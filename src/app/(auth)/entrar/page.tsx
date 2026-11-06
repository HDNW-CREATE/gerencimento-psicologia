import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar', robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; saiu?: string; expirada?: string; senha?: string }>;
}) {
  const sp = await searchParams;
  const notice = sp.saiu
    ? 'Você saiu de todos os dispositivos.'
    : sp.expirada
      ? 'Por segurança, sua sessão expirou. Entre novamente.'
      : sp.senha
        ? 'Senha alterada. Entre com a nova senha.'
        : undefined;
  return <LoginForm callbackUrl={sp.callbackUrl} notice={notice} />;
}
