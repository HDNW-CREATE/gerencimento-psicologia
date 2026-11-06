import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/server/session';
import { EMPTY_PATIENT, PatientForm } from '../patient-form';

export const metadata: Metadata = { title: 'Novo paciente' };

export default async function NewPatientPage() {
  await requirePermission('patients.write');
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/pacientes" className="text-sm text-primary hover:underline">
          ← Pacientes
        </Link>
        <h1 className="mt-1 text-3xl">Novo paciente</h1>
        <p className="text-muted-foreground">
          Cadastro feito pela psicóloga (o paciente poderá criar a conta depois, usando o mesmo
          e-mail).
        </p>
      </div>
      <PatientForm initial={EMPTY_PATIENT} />
    </div>
  );
}
