'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LegalText } from '@/components/legal-text';
import { useServerAction } from '@/components/forms/use-action';
import { acceptPendingConsentsAction } from '@/server/actions/consent';

interface Doc {
  id: string;
  title: string;
  version: number;
  content: string;
}

export function AcceptForm({ docs }: { docs: Doc[] }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const { execute, pending } = useServerAction(acceptPendingConsentsAction, {
    onSuccess: () => {
      router.push('/paciente');
      router.refresh();
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Documentos atualizados</CardTitle>
        <CardDescription>Para continuar, leia e aceite as novas versões.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {docs.map((d) => (
          <details key={d.id} className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">
              {d.title} (v{d.version})
            </summary>
            <div className="mt-3 max-h-72 overflow-y-auto text-sm">
              <LegalText content={d.content} />
            </div>
          </details>
        ))}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[hsl(var(--primary))]"
            checked={ok}
            onChange={(e) => setOk(e.target.checked)}
          />
          Li e aceito as versões acima.
        </label>
        <Button className="w-full" disabled={!ok} loading={pending} onClick={() => execute()}>
          Aceitar e continuar
        </Button>
      </CardContent>
    </Card>
  );
}
