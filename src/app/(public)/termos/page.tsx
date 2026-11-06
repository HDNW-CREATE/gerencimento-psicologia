import type { Metadata } from 'next';
import { LegalPage, legalTitle } from '../_legal-page';

export async function generateMetadata(): Promise<Metadata> {
  return { title: await legalTitle('TERMOS_DE_USO'), alternates: { canonical: '/termos' } };
}

export default function TermsPage() {
  return <LegalPage type="TERMOS_DE_USO" />;
}
