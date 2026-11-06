import type { Metadata } from 'next';
import { LegalPage, legalTitle } from '../_legal-page';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await legalTitle('POLITICA_PRIVACIDADE'),
    alternates: { canonical: '/privacidade' },
  };
}

export default function PrivacyPolicyPage() {
  return <LegalPage type="POLITICA_PRIVACIDADE" />;
}
