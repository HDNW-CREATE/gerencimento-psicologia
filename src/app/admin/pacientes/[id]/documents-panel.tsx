'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { fmtDate } from '@/lib/format';
import {
  deleteDocumentAction,
  updateDocumentAction,
  uploadPatientDocumentAction,
} from '@/server/actions/uploads';

interface Doc {
  id: string;
  title: string;
  kind: string;
  shared: boolean;
  createdAt: string;
  sizeBytes: number;
}

export function DocumentsPanel({ patientId, docs }: { patientId: string; docs: Doc[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('DECLARACAO');
  const [shared, setShared] = useState(true);
  const [removing, setRemoving] = useState<Doc | null>(null);

  const upload = useServerAction(uploadPatientDocumentAction, {
    onSuccess: () => {
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    },
  });
  const toggle = useServerAction(updateDocumentAction, { onSuccess: () => router.refresh() });
  const remove = useServerAction(deleteDocumentAction, {
    onSuccess: () => {
      setRemoving(null);
      router.refresh();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos</CardTitle>
        <CardDescription>
          Atestados, declarações etc. Só ficam visíveis ao paciente se você marcar “compartilhar”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {docs.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nenhum documento.</li>
          )}
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(d.createdAt)} · {Math.max(1, Math.round(d.sizeBytes / 1024))} KB
                </p>
              </div>
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    className="size-4 accent-[hsl(var(--primary))]"
                    checked={d.shared}
                    disabled={toggle.pending}
                    onChange={(e) => toggle.execute({ id: d.id, shared: e.target.checked })}
                  />
                  {d.shared ? (
                    <Badge variant="success">Compartilhado</Badge>
                  ) : (
                    <Badge variant="muted">Privado</Badge>
                  )}
                </label>
                <Button asChild size="icon" variant="ghost" aria-label={`Baixar ${d.title}`}>
                  <a href={`/api/documents/${d.id}`}>
                    <Download />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${d.title}`}
                  onClick={() => setRemoving(d)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <form
          className="space-y-3 rounded-lg bg-muted/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set('patientId', patientId);
            fd.set('title', title);
            fd.set('kind', kind);
            fd.set('shared', String(shared));
            fd.set('file', file);
            upload.execute(fd);
          }}
        >
          <p className="text-sm font-semibold">Enviar novo documento</p>
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Título</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Declaração de comparecimento"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-kind">Tipo</Label>
              <NativeSelect id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="DECLARACAO">Declaração</option>
                <option value="ATESTADO">Atestado</option>
                <option value="RECIBO">Recibo</option>
                <option value="OUTRO">Outro</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">Arquivo (PDF ou imagem, até 5 MB)</Label>
              <input
                id="doc-file"
                ref={fileRef}
                type="file"
                required
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2.5 file:text-sm file:font-medium"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[hsl(var(--primary))]"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />{' '}
            Compartilhar com o paciente
          </label>
          <Button type="submit" loading={upload.pending}>
            Enviar
          </Button>
        </form>
      </CardContent>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        destructive
        title="Remover documento?"
        description={`“${removing?.title}” deixará de aparecer para você e para o paciente.`}
        confirmLabel="Remover"
        loading={remove.pending}
        onConfirm={() => removing && remove.execute({ id: removing.id })}
      />
    </Card>
  );
}
