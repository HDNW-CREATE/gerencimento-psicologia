'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { publishLegalDocumentAction } from '@/server/actions/settings';

interface Props {
  type: 'TERMO_CONSENTIMENTO' | 'POLITICA_PRIVACIDADE' | 'TERMOS_DE_USO';
  label: string;
  title: string;
  content: string;
  version: number;
  accepted: number;
}

export function LegalEditor({ type, label, title, content, version, accepted }: Props) {
  const router = useRouter();
  const [t, setT] = useState(title);
  const [c, setC] = useState(content);
  const [confirm, setConfirm] = useState(false);
  const { execute, pending } = useServerAction(publishLegalDocumentAction, {
    onSuccess: () => {
      setConfirm(false);
      router.refresh();
    },
  });
  const changed = t !== title || c !== content;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {label}{' '}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            versão vigente: v{version} · {accepted} aceite(s)
          </span>
        </CardTitle>
        <CardDescription>
          Use “## Título” para criar seções. Parágrafos são separados por linha em branco.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Título" htmlFor={`t-${type}`}>
          <Input id={`t-${type}`} value={t} onChange={(e) => setT(e.target.value)} />
        </Field>
        <Field label="Texto" htmlFor={`c-${type}`}>
          <Textarea
            id={`c-${type}`}
            className="min-h-72 font-mono text-sm"
            value={c}
            onChange={(e) => setC(e.target.value)}
          />
        </Field>
        <Button disabled={!changed} onClick={() => setConfirm(true)}>
          Publicar nova versão
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Publicar ${label} v${version + 1}?`}
        description="A versão anterior continua registrada nos aceites já feitos. Todos os pacientes precisarão aceitar a nova versão no próximo acesso."
        confirmLabel="Publicar"
        loading={pending}
        onConfirm={() => execute({ type, title: t, content: c })}
      />
    </Card>
  );
}
