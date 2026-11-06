'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Trash2, UserX, XCircle, Ban, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { StatusBadge, PaymentBadge } from '@/components/status-badge';
import { useServerAction } from '@/components/forms/use-action';
import { fmtDateTime, formatBRL, modalityLabels } from '@/lib/format';
import {
  staffDeleteAppointmentAction,
  staffSetStatusAction,
  staffUpdateAppointmentAction,
  type CalendarEventDTO,
} from '@/server/actions/appointments';

interface Props {
  event: CalendarEventDTO | null;
  patientName: string;
  canClinical: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type StatusValue =
  'CONFIRMADA' | 'REALIZADA' | 'FALTA' | 'CANCELADA_PSICOLOGA' | 'RECUSADA' | 'AGENDADA';

export function EventDialog({ event, patientName, canClinical, onClose, onChanged }: Props) {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [note, setNote] = useState('');
  const [scope, setScope] = useState<'THIS' | 'FOLLOWING'>('THIS');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<null | {
    status: StatusValue;
    title: string;
    destructive?: boolean;
    needsReason?: boolean;
  }>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setMeetingUrl(event.meetingUrl ?? '');
      setNote(event.adminNote ?? '');
      setScope('THIS');
      setReason('');
    }
  }, [event]);

  const setStatus = useServerAction(staffSetStatusAction, {
    onSuccess: () => {
      setConfirm(null);
      onChanged();
    },
  });
  const save = useServerAction(staffUpdateAppointmentAction, { onSuccess: onChanged });
  const del = useServerAction(staffDeleteAppointmentAction, {
    onSuccess: () => {
      setDeleteOpen(false);
      onChanged();
    },
  });

  if (!event) return null;
  const closed = ['CANCELADA_PACIENTE', 'CANCELADA_PSICOLOGA', 'RECUSADA'].includes(event.status);

  const act = (
    status: StatusValue,
    title: string,
    opts: { destructive?: boolean; needsReason?: boolean } = {},
  ) => {
    if (opts.destructive || opts.needsReason) setConfirm({ status, title, ...opts });
    else setStatus.execute({ id: event.id, status, scope: 'THIS', notify: true });
  };

  return (
    <>
      <Dialog open={!!event} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{patientName}</DialogTitle>
            <DialogDescription>
              {event.serviceName} · {modalityLabels[event.modality]} · {fmtDateTime(event.start)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            {event.paymentStatus && <PaymentBadge status={event.paymentStatus} />}
            <span className="text-sm text-muted-foreground">{formatBRL(event.priceCents)}</span>
            {event.recurrenceId && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Série recorrente</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {event.status === 'PENDENTE' && (
              <>
                <Button size="sm" onClick={() => act('CONFIRMADA', 'Confirmar')}>
                  <Check /> Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    act('RECUSADA', 'Recusar este pedido?', {
                      destructive: true,
                      needsReason: true,
                    })
                  }
                >
                  <Ban /> Recusar
                </Button>
              </>
            )}
            {event.status === 'AGENDADA' && (
              <Button size="sm" onClick={() => act('CONFIRMADA', 'Confirmar')}>
                <Check /> Confirmar presença
              </Button>
            )}
            {['AGENDADA', 'CONFIRMADA'].includes(event.status) && (
              <>
                <Button size="sm" variant="secondary" onClick={() => act('REALIZADA', 'Realizada')}>
                  <Check /> Marcar realizada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act('FALTA', 'Registrar falta?', { destructive: true })}
                >
                  <UserX /> Falta
                </Button>
              </>
            )}
            {!closed && event.status !== 'REALIZADA' && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() =>
                  act('CANCELADA_PSICOLOGA', 'Cancelar sessão?', {
                    destructive: true,
                    needsReason: true,
                  })
                }
              >
                <XCircle /> Cancelar
              </Button>
            )}
            {closed && (
              <Button size="sm" variant="outline" onClick={() => act('AGENDADA', 'Reabrir')}>
                Reabrir sessão
              </Button>
            )}
          </div>

          {event.recurrenceId && !closed && (
            <fieldset className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
              <legend className="px-1 text-xs font-medium uppercase text-muted-foreground">
                Aplicar alterações a
              </legend>
              <label className="flex items-center gap-2">
                <input type="radio" checked={scope === 'THIS'} onChange={() => setScope('THIS')} />{' '}
                Apenas esta sessão
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === 'FOLLOWING'}
                  onChange={() => setScope('FOLLOWING')}
                />{' '}
                Esta e as próximas da série
              </label>
            </fieldset>
          )}

          {event.modality === 'ONLINE' && (
            <div className="space-y-1.5">
              <Label htmlFor="e-url">Link da sessão online</Label>
              <Input
                id="e-url"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="e-note">Observação administrativa</Label>
            <Textarea
              id="e-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="min-h-16"
            />
          </div>

          <DialogFooter className="sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/pacientes/${event.patientId}`}>Ficha do paciente</Link>
              </Button>
              {canClinical && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/pacientes/${event.patientId}/prontuario?sessao=${event.id}`}>
                    <FileText /> Evolução
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 /> Excluir
              </Button>
            </div>
            <Button
              loading={save.pending}
              onClick={() => save.execute({ id: event.id, meetingUrl, adminNote: note, scope })}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ''}
        destructive={confirm?.destructive}
        description={
          confirm?.status === 'CANCELADA_PSICOLOGA' || confirm?.status === 'RECUSADA'
            ? 'O paciente será avisado por e-mail.'
            : confirm?.status === 'FALTA'
              ? 'A falta pode gerar cobrança, conforme as configurações do consultório.'
              : ''
        }
        confirmLabel="Confirmar"
        loading={setStatus.pending}
        onConfirm={() =>
          confirm &&
          setStatus.execute({
            id: event.id,
            status: confirm.status,
            reason,
            scope: confirm.status === 'CANCELADA_PSICOLOGA' ? scope : 'THIS',
            notify: true,
          })
        }
      >
        {confirm?.needsReason && (
          <div className="space-y-1.5">
            <Label htmlFor="e-reason">Motivo (aparece no e-mail ao paciente)</Label>
            <Textarea
              id="e-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        destructive
        title="Excluir esta sessão?"
        description="Use apenas para corrigir um lançamento errado. Para sessões que realmente existiram, prefira 'Cancelar'. Esta ação não avisa o paciente."
        confirmLabel="Excluir"
        loading={del.pending}
        onConfirm={() => del.execute({ id: event.id })}
      />
    </>
  );
}
