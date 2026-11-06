'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/rich-text-editor';
import { useServerAction } from '@/components/forms/use-action';
import { createRecordAction } from '@/server/actions/clinical';

export function NewRecordForm({
  patientId,
  appointments,
  defaultAppointmentId,
}: {
  patientId: string;
  appointments: { id: string; label: string }[];
  defaultAppointmentId?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [appointmentId, setAppointmentId] = useState(
    appointments.some((a) => a.id === defaultAppointmentId) ? defaultAppointmentId! : '',
  );
  const [resetKey, setResetKey] = useState(0);
  const { execute, pending } = useServerAction(createRecordAction, {
    onSuccess: () => {
      setTitle('');
      setHtml('');
      setAppointmentId('');
      setResetKey((k) => k + 1);
      router.refresh();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova evolução</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rec-title">Título (opcional)</Label>
            <Input
              id="rec-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-appt">Sessão relacionada</Label>
            <NativeSelect
              id="rec-appt"
              value={appointmentId}
              onChange={(e) => setAppointmentId(e.target.value)}
            >
              <option value="">Sem sessão específica</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <RichTextEditor
          key={resetKey}
          value={html}
          onChange={setHtml}
          label="Texto da evolução"
          minHeight="12rem"
        />
        <p className="text-xs text-muted-foreground">
          Ao salvar, o texto é criptografado (AES-256-GCM). Registros não podem ser apagados — só
          retificados com histórico.
        </p>
        <Button
          loading={pending}
          disabled={!html}
          onClick={() => execute({ patientId, appointmentId, title, html })}
        >
          Salvar evolução
        </Button>
      </CardContent>
    </Card>
  );
}
