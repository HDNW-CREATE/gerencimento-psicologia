'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { archivePatientAction, setPatientStatusAction } from '@/server/actions/patients';

export function PatientTools({ patientId, status }: { patientId: string; status: string }) {
  const router = useRouter();
  const [archive, setArchive] = useState(false);
  const st = useServerAction(setPatientStatusAction, { onSuccess: () => router.refresh() });
  const ar = useServerAction(archivePatientAction, {
    onSuccess: () => router.push('/admin/pacientes'),
    onError: () => setArchive(false),
  });
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="pt-status">Situação do paciente</Label>
        <NativeSelect
          id="pt-status"
          className="w-44"
          defaultValue={status}
          disabled={st.pending}
          onChange={(e) => st.execute({ id: patientId, status: e.target.value })}
        >
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
          <option value="ALTA">Alta</option>
        </NativeSelect>
      </div>
      <Button
        variant="ghost"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setArchive(true)}
      >
        <Archive /> Arquivar paciente
      </Button>
      <ConfirmDialog
        open={archive}
        onOpenChange={setArchive}
        destructive
        title="Arquivar este paciente?"
        description="O paciente deixa de aparecer nas listas e não poderá agendar. O prontuário e o financeiro são preservados (guarda mínima de 5 anos)."
        confirmLabel="Arquivar"
        loading={ar.pending}
        onConfirm={() => ar.execute({ id: patientId })}
      />
    </div>
  );
}
