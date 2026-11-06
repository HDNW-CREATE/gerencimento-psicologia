'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useServerAction } from '@/components/forms/use-action';
import { resolveDataRequestAction } from '@/server/actions/lgpd';

interface Req {
  id: string;
  type: 'EXPORTACAO' | 'EXCLUSAO';
  status: 'ABERTA' | 'EM_ANALISE' | 'CONCLUIDA' | 'NEGADA';
  message: string | null;
  resolutionNote: string | null;
  createdLabel: string;
  resolvedLabel: string | null;
  userName: string;
  userEmail: string;
}

const label = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  CONCLUIDA: 'Concluída',
  NEGADA: 'Negada',
} as const;

export function RequestCard({ req }: { req: Req }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [dialog, setDialog] = useState<null | 'done' | 'deny' | 'anonymize'>(null);
  const { execute, pending } = useServerAction(resolveDataRequestAction, {
    onSuccess: () => {
      setDialog(null);
      router.refresh();
    },
    onError: () => setDialog(null),
  });
  const closed = req.status === 'CONCLUIDA' || req.status === 'NEGADA';

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>
            {req.type === 'EXPORTACAO' ? 'Cópia dos dados' : 'Exclusão da conta'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {req.userName} · {req.userEmail}
          </p>
          <p className="text-xs text-muted-foreground">Pedido em {req.createdLabel}</p>
        </div>
        <Badge
          variant={
            req.status === 'CONCLUIDA'
              ? 'success'
              : req.status === 'NEGADA'
                ? 'destructive'
                : 'warning'
          }
        >
          {label[req.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {req.message && <p className="rounded-lg bg-muted p-3">“{req.message}”</p>}
        {req.resolutionNote && <p>Resposta: {req.resolutionNote}</p>}
        {!closed && (
          <>
            {req.type === 'EXPORTACAO' && (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/export/lgpd/${req.id}`}>
                  <Download /> Baixar dados (JSON)
                </a>
              </Button>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`note-${req.id}`}>Resposta ao paciente / justificativa</Label>
              <Textarea
                id={`note-${req.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                className="min-h-16"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {req.status === 'ABERTA' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => execute({ id: req.id, decision: 'EM_ANALISE', note })}
                >
                  Marcar em análise
                </Button>
              )}
              {req.type === 'EXCLUSAO' ? (
                <Button size="sm" onClick={() => setDialog('anonymize')}>
                  Atender (anonimizar conta)
                </Button>
              ) : (
                <Button size="sm" onClick={() => setDialog('done')}>
                  Marcar como concluída
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDialog('deny')}
              >
                Negar
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={dialog === 'done'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Concluir pedido?"
        description="Certifique-se de ter enviado a cópia dos dados ao titular."
        loading={pending}
        onConfirm={() => execute({ id: req.id, decision: 'CONCLUIDA', note })}
      />
      <ConfirmDialog
        open={dialog === 'anonymize'}
        onOpenChange={(o) => !o && setDialog(null)}
        destructive
        title="Anonimizar a conta deste paciente?"
        description="A conta de acesso e os dados de contato serão removidos de forma irreversível. O prontuário e o histórico financeiro são preservados (guarda legal)."
        confirmLabel="Anonimizar"
        loading={pending}
        onConfirm={() => execute({ id: req.id, decision: 'CONCLUIDA', note, anonymize: true })}
      />
      <ConfirmDialog
        open={dialog === 'deny'}
        onOpenChange={(o) => !o && setDialog(null)}
        destructive
        title="Negar pedido?"
        description="Informe a justificativa no campo de resposta (obrigatória), por exemplo a obrigação legal de guarda do prontuário."
        confirmLabel="Negar"
        loading={pending}
        onConfirm={() => execute({ id: req.id, decision: 'NEGADA', note })}
      />
    </Card>
  );
}
