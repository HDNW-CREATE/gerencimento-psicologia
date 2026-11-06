import type { Metadata } from 'next';
import { ForgotForm } from './forgot-form';

export const metadata: Metadata = { title: 'Esqueci minha senha', robots: { index: false } };

export default function ForgotPage() {
  return <ForgotForm />;
}
