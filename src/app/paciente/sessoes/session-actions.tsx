'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarClock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
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
import { SlotPicker } from '@/components/slot-picker';
import { useServerAction } from '@/components/forms/use-action';
import { fmtDateTime } from '@/lib/format';
import { patientCancelAction, patientRescheduleAction } from '@/server/actions/appointments';

interface Props {
  appointmentId: string;
  serviceTypeId: string;
  modality: 'PRESENCIAL' | 'ONLINE';
  startsAtIso: string;
  /** false = fora do prazo: mostramos aviso e orientamos contato. */
  withinDeadline: boolean;
  minCancelHours: number;
  contactHint: string;
}

export function SessionActions({
  appointmentId,
  serviceTypeId,
  modality,
  startsAtIso,
  withinDeadline,
  minCancelHours,
  contactHint,
}: Props) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [newStart, setNewStart] = useState<string | undefined>();

  const cancel = useServerAction(patientCancelAction, {
    onSuccess: () => {
      setCancelOpen(false);
      router.refresh();
    },
  });
  const resched = useServerAction(patientRescheduleAction, {
    onSuccess: () => {
      setReschedOpen(false);
      router.refresh();
    },
  });

  if (!withinDeadline) {
    return (
      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        O prazo para remarcar ou cancelar pelo sistema é de {minCancelHours}h antes da sessão.{' '}
        {contactHint}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setReschedOpen(true)}>
          <CalendarClock /> Remarcar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setCancelOpen(true)}
        >
          <XCircle /> Cancelar
        </Button>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        destructive
        title="Cancelar esta sessão?"
        description={`A sessão de ${fmtDateTime(startsAtIso)} será cancelada e o horário ficará livre para outras pessoas.`}
        confirmLabel="Sim, cancelar"
        cancelLabel="Manter sessão"
        loading={cancel.pending}
        onConfirm={() => cancel.execute({ id: appointmentId, reason })}
      >
        <div className="space-y-1.5">
          <Label htmlFor={`reason-${appointmentId}`}>Motivo (opcional)</Label>
          <Textarea
            id={`reason-${appointmentId}`}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <Dialog open={reschedOpen} onOpenChange={setReschedOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Remarcar sessão</DialogTitle>
            <DialogDescription>
              Sessão atual: {fmtDateTime(startsAtIso)}. Escolha o novo horário.
            </DialogDescription>
          </DialogHeader>
          {reschedOpen && (
            <SlotPicker
              serviceTypeId={serviceTypeId}
              modality={modality}
              excludeAppointmentId={appointmentId}
              value={newStart}
              onChange={setNewStart}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedOpen(false)}>
              Voltar
            </Button>
            <Button
              disabled={!newStart}
              loading={resched.pending}
              onClick={() => newStart && resched.execute({ id: appointmentId, startsAt: newStart })}
            >
              Confirmar novo horário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
