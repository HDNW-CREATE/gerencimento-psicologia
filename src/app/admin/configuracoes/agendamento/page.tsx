import type { Metadata } from 'next';
import { getScheduling } from '@/lib/settings';
import { SchedulingForm } from './scheduling-form';

export const metadata: Metadata = { title: 'Regras de agendamento' };

export default async function SchedulingPage() {
  return <SchedulingForm initial={await getScheduling()} />;
}
