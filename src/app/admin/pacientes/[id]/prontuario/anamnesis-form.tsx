'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { useServerAction } from '@/components/forms/use-action';
import { saveAnamnesisAction } from '@/server/actions/clinical';

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'yesno';
}

export function AnamnesisForm({
  patientId,
  fields,
  initial,
  meta,
}: {
  patientId: string;
  fields: FieldDef[];
  initial: Record<string, string>;
  meta: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, string>>(initial);
  const { execute, pending } = useServerAction(saveAnamnesisAction, {
    onSuccess: () => router.refresh(),
  });
  const set = (k: string, v: string) => setData((d) => ({ ...d, [k]: v }));

  // Respostas antigas de campos removidos continuam preservadas
  const orphan = Object.keys(initial).filter((k) => !fields.some((f) => f.key === k));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anamnese / ficha inicial</CardTitle>
        <CardDescription>
          {meta}. Os campos podem ser configurados em Configurações → Anamnese.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`an-${f.key}`}>
            {f.type === 'textarea' ? (
              <Textarea
                id={`an-${f.key}`}
                value={data[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                className="min-h-24"
              />
            ) : f.type === 'yesno' ? (
              <NativeSelect
                id={`an-${f.key}`}
                value={data[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
              >
                <option value="">—</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </NativeSelect>
            ) : (
              <Input
                id={`an-${f.key}`}
                value={data[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </Field>
        ))}
        {orphan.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {orphan.length} resposta(s) de campos antigos foram mantidas no histórico.
          </p>
        )}
        <Button loading={pending} onClick={() => execute({ patientId, data })}>
          Salvar anamnese
        </Button>
      </CardContent>
    </Card>
  );
}
