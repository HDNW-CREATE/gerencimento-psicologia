import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Criar conta', robots: { index: false } };

export default async function RegisterPage() {
  const docs = await db.legalDocument.findMany({
    where: { type: { in: ['TERMO_CONSENTIMENTO', 'POLITICA_PRIVACIDADE'] } },
    orderBy: { version: 'desc' },
  });
  const termo = docs.find((d) => d.type === 'TERMO_CONSENTIMENTO');
  const politica = docs.find((d) => d.type === 'POLITICA_PRIVACIDADE');
  return (
    <RegisterForm termoVersion={termo?.version ?? 1} politicaVersion={politica?.version ?? 1} />
  );
}
