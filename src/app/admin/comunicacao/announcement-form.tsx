'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { sendAnnouncementAction } from '@/server/actions/communication';

export function AnnouncementForm({
  patients,
  activeCount,
}: {
  patients: { id: string; name: string }[];
  activeCount: number;
}) {
  const [scope, setScope] = useState<'one' | 'all'>('one');
  const [patientId, setPatientId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { execute, pending } = useServerAction(sendAnnouncementAction, {
    onSuccess: () => {
      setConfirm(false);
      setSubject('');
      setMessage('');
    },
    onError: () => setConfirm(false),
  });
  const send = () =>
    execute({ scope, patientId: scope === 'one' ? patientId : undefined, subject, message });

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Enviar aviso por e-mail</CardTitle>
        <CardDescription>
          O e-mail usa o layout do consultório e o modelo “Aviso / mensagem aos pacientes”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Destinatário" htmlFor="ann-scope">
          <NativeSelect
            id="ann-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'one' | 'all')}
          >
            <option value="one">Um paciente</option>
            <option value="all">Todos os pacientes ativos ({activeCount})</option>
          </NativeSelect>
        </Field>
        {scope === 'one' && (
          <Field label="Paciente" htmlFor="ann-patient">
            <NativeSelect
              id="ann-patient"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Assunto" htmlFor="ann-subject">
          <Input
            id="ann-subject"
            value={subject}
            maxLength={150}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field
          label="Mensagem"
          htmlFor="ann-msg"
          hint="Use linhas em branco para separar parágrafos."
        >
          <Textarea
            id="ann-msg"
            className="min-h-40"
            value={message}
            maxLength={4000}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <Button
          disabled={!subject || !message || (scope === 'one' && !patientId)}
          loading={pending && !confirm}
          onClick={() => (scope === 'all' ? setConfirm(true) : send())}
        >
          Enviar
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Enviar para ${activeCount} paciente(s)?`}
        description="O e-mail será enviado a todos os pacientes ativos que aceitam avisos. Esta ação não pode ser desfeita."
        confirmLabel="Enviar a todos"
        loading={pending}
        onConfirm={send}
      />
    </Card>
  );
}
