import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPendingConsents } from '@/server/consents';
import { requirePatient } from '@/server/session';
import { AcceptForm } from './accept-form';

export const metadata: Metadata = { title: 'Atualização dos termos', robots: { index: false } };

export default async function AcceptTermsPage() {
  const user = await requirePatient();
  const pending = await getPendingConsents(user.id);
  if (pending.length === 0) redirect('/paciente');
  return (
    <AcceptForm
      docs={pending.map((d) => ({
        id: d.id,
        title: d.title,
        version: d.version,
        content: d.content,
      }))}
    />
  );
}
