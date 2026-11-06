import type { Metadata } from 'next';
import { LegalPage, legalTitle } from '../_legal-page';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await legalTitle('TERMO_CONSENTIMENTO'),
    alternates: { canonical: '/termo-de-consentimento' },
  };
}

export default function ConsentTermPage() {
  return <LegalPage type="TERMO_CONSENTIMENTO" />;
}
