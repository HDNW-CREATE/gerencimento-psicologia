import type { Metadata } from 'next';
import { getClinic } from '@/lib/settings';
import { ClinicForm } from './clinic-form';

export const metadata: Metadata = { title: 'Dados profissionais' };

export default async function ClinicPage() {
  return <ClinicForm initial={await getClinic()} />;
}
