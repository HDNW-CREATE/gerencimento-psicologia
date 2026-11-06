import type { Metadata } from 'next';
import { getAnamnesisConfig } from '@/lib/settings';
import { AnamnesisConfigForm } from './anamnesis-config-form';

export const metadata: Metadata = { title: 'Campos da anamnese' };

export default async function AnamnesisConfigPage() {
  return <AnamnesisConfigForm initial={(await getAnamnesisConfig()).fields} />;
}
