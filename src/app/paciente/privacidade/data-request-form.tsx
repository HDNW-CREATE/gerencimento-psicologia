'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { createDataRequestAction } from '@/server/actions/profile';

export function DataRequestForm() {
  const router = useRouter();
  const [type, setType] = useState<'EXPORTACAO' | 'EXCLUSAO'>('EXPORTACAO');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { execute, pending } = useServerAction(createDataRequestAction, {
    onSuccess: () => {
      setConfirm(false);
      setMessage('');
      router.refresh();
    },
    onError: () => setConfirm(false),
  });

  const submit = () => execute({ type, message });

  return (
    <div className="space-y-4">
      <Field label="Tipo de pedido" htmlFor="dr-type">
        <NativeSelect
          id="dr-type"
          value={type}
          onChange={(e) => setType(e.target.value as 'EXPORTACAO' | 'EXCLUSAO')}
        >
          <option value="EXPORTACAO">Receber uma cópia dos meus dados</option>
          <option value="EXCLUSAO">Solicitar exclusão da minha conta</option>
        </NativeSelect>
      </Field>
      {type === 'EXCLUSAO' && (
        <p className="rounded-lg bg-warning/10 p-3 text-sm">
          O prontuário psicológico precisa ser guardado por, no mínimo, 5 anos por determinação do
          Conselho Federal de Psicologia. Ao atender o pedido, sua conta e seus dados de contato são
          removidos, mas o registro clínico obrigatório é preservado, de forma sigilosa.
        </p>
      )}
      <Field label="Mensagem (opcional)" htmlFor="dr-msg">
        <Textarea
          id="dr-msg"
          value={message}
          maxLength={500}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-20"
        />
      </Field>
      <Button
        loading={pending && !confirm}
        onClick={() => (type === 'EXCLUSAO' ? setConfirm(true) : submit())}
      >
        Enviar pedido
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title="Solicitar exclusão da conta?"
        description="A psicóloga vai analisar o pedido. Você será avisado(a) por e-mail sobre a decisão."
        confirmLabel="Enviar pedido"
        loading={pending}
        onConfirm={submit}
      />
    </div>
  );
}
