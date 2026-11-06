'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { History, Pencil, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { RichTextEditor } from '@/components/rich-text-editor';
import { useServerAction } from '@/components/forms/use-action';
import { amendRecordAction, retractRecordAction } from '@/server/actions/clinical';
import { getRecordVersionsAction, type VersionDTO } from '@/server/actions/clinical-history';

interface RecordDTO {
  id: string;
  title: string;
  html: string;
  version: number;
  retracted: boolean;
  retractedReason: string | null;
  sessionLabel: string | null;
  createdLabel: string;
  updatedLabel: string;
}

export function RecordCard({ patientId, record }: { patientId: string; record: RecordDTO }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [retractOpen, setRetractOpen] = useState(false);
  const [title, setTitle] = useState(record.title);
  const [html, setHtml] = useState(record.html);
  const [reason, setReason] = useState('');
  const [versions, setVersions] = useState<VersionDTO[] | null>(null);

  const amend = useServerAction(amendRecordAction, {
    onSuccess: () => {
      setEditOpen(false);
      setReason('');
      router.refresh();
    },
  });
  const retract = useServerAction(retractRecordAction, {
    onSuccess: () => {
      setRetractOpen(false);
      setReason('');
      router.refresh();
    },
  });
  const history = useServerAction(getRecordVersionsAction, {
    successToast: false,
    onSuccess: (r) => setVersions(r.data ?? []),
  });

  return (
    <Card className={record.retracted ? 'opacity-70' : undefined}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>{record.title || 'Evolução'}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {record.sessionLabel ? `Sessão de ${record.sessionLabel} · ` : ''}Registrado em{' '}
            {record.createdLabel}
            {record.version > 1 ? ` · retificado em ${record.updatedLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">v{record.version}</Badge>
          {record.retracted && <Badge variant="destructive">Invalidado</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* HTML sanitizado no servidor na leitura e na gravação */}
        <div
          className="rich-content text-[15px]"
          dangerouslySetInnerHTML={{ __html: record.html }}
        />
        {record.retracted && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm">
            Motivo da invalidação: {record.retractedReason}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!record.retracted && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTitle(record.title);
                  setHtml(record.html);
                  setEditOpen(true);
                }}
              >
                <Pencil /> Retificar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setRetractOpen(true)}
              >
                <Ban /> Invalidar
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setHistOpen(true);
              history.execute({ recordId: record.id });
            }}
          >
            <History /> Histórico
          </Button>
        </div>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Retificar registro</DialogTitle>
            <DialogDescription>
              Uma nova versão será criada. A versão atual continua guardada no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`t-${record.id}`}>Título</Label>
              <Input
                id={`t-${record.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <RichTextEditor value={html} onChange={setHtml} label="Texto retificado" />
            <div className="space-y-1.5">
              <Label htmlFor={`r-${record.id}`}>Motivo da retificação *</Label>
              <Textarea
                id={`r-${record.id}`}
                value={reason}
                className="min-h-16"
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              loading={amend.pending}
              disabled={reason.trim().length < 3 || !html}
              onClick={() => amend.execute({ recordId: record.id, patientId, title, html, reason })}
            >
              Salvar nova versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={retractOpen}
        onOpenChange={setRetractOpen}
        destructive
        title="Invalidar este registro?"
        description="O registro NÃO é apagado (obrigação de guarda): ele fica marcado como invalidado e permanece no histórico e na exportação."
        confirmLabel="Invalidar"
        loading={retract.pending}
        onConfirm={() => retract.execute({ recordId: record.id, patientId, reason })}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`rr-${record.id}`}>Motivo *</Label>
          <Textarea
            id={`rr-${record.id}`}
            value={reason}
            className="min-h-16"
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de alterações</DialogTitle>
            <DialogDescription>
              Todas as versões, da mais recente para a mais antiga.
            </DialogDescription>
          </DialogHeader>
          {!versions ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <ol className="space-y-4">
              {versions.map((v) => (
                <li key={v.version} className="rounded-lg border p-3">
                  <p className="mb-1 text-xs text-muted-foreground">
                    <strong>v{v.version}</strong> · {v.createdLabel}
                    {v.reason ? ` · motivo: ${v.reason}` : ' · versão original'}
                  </p>
                  {v.title && <p className="font-medium">{v.title}</p>}
                  <div
                    className="rich-content text-sm"
                    dangerouslySetInnerHTML={{ __html: v.html }}
                  />
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
