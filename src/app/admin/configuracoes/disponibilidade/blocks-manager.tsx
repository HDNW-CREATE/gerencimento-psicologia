'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { fmtDateTime } from '@/lib/format';
import { createBlockAction, deleteBlockAction } from '@/server/actions/settings';

interface Block {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export function BlocksManager({ blocks }: { blocks: Block[] }) {
  const router = useRouter();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState<Block | null>(null);

  const create = useServerAction(createBlockAction, {
    onSuccess: () => {
      setStart('');
      setEnd('');
      setReason('');
      router.refresh();
    },
  });
  const remove = useServerAction(deleteBlockAction, {
    onSuccess: () => {
      setRemoving(null);
      router.refresh();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bloqueios (férias, feriados, compromissos)</CardTitle>
        <CardDescription>
          Nenhum horário é oferecido aos pacientes dentro de um bloqueio. Para o dia inteiro, use
          00:00 até 23:59.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="b-start">Início</Label>
            <Input
              id="b-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-end">Fim</Label>
            <Input
              id="b-end"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="b-reason">Motivo (opcional)</Label>
            <Input
              id="b-reason"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Férias"
            />
          </div>
        </div>
        <Button
          disabled={!start || !end}
          loading={create.pending}
          onClick={() =>
            create.execute({
              startsAt: new Date(start).toISOString(),
              endsAt: new Date(end).toISOString(),
              reason,
            })
          }
        >
          Criar bloqueio
        </Button>

        <ul className="divide-y rounded-lg border">
          {blocks.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">Nenhum bloqueio futuro.</li>
          )}
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium">{b.reason || 'Bloqueio'}</p>
                <p className="text-muted-foreground">
                  {fmtDateTime(b.startsAt)} → {fmtDateTime(b.endsAt)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remover bloqueio"
                onClick={() => setRemoving(b)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remover este bloqueio?"
        description="Os horários deste período voltarão a ser oferecidos aos pacientes."
        confirmLabel="Remover"
        destructive
        loading={remove.pending}
        onConfirm={() => removing && remove.execute({ id: removing.id })}
      />
    </Card>
  );
}
