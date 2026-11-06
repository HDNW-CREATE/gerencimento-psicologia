'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarCheck, Monitor, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SlotPicker } from '@/components/slot-picker';
import { useServerAction } from '@/components/forms/use-action';
import { cn } from '@/lib/utils';
import { fmtLongDate, fmtTime } from '@/lib/format';
import { bookAppointmentAction } from '@/server/actions/appointments';

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  allowsOnline: boolean;
  allowsInPerson: boolean;
}

export function BookingWizard({
  services,
  manualApproval,
  minCancelHours,
  disabled,
}: {
  services: ServiceOption[];
  manualApproval: boolean;
  minCancelHours: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const service = services.find((s) => s.id === serviceId);
  const [modality, setModality] = useState<'PRESENCIAL' | 'ONLINE'>(
    service?.allowsInPerson ? 'PRESENCIAL' : 'ONLINE',
  );
  const [startsAt, setStartsAt] = useState<string | undefined>();
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const { execute, pending } = useServerAction(bookAppointmentAction, {
    successToast: false,
    onSuccess: (r) => {
      setDoneMsg(r.message ?? 'Pronto!');
      router.refresh();
    },
  });

  if (doneMsg) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <CalendarCheck className="mx-auto size-12 text-primary" aria-hidden />
          <h2 className="text-2xl">{manualApproval ? 'Pedido enviado!' : 'Sessão agendada!'}</h2>
          <p role="status">{doneMsg}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => router.push('/paciente/sessoes')}>Ver minhas sessões</Button>
            <Button variant="outline" onClick={() => router.push('/paciente')}>
              Voltar ao início
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pickService = (id: string) => {
    setServiceId(id);
    const s = services.find((x) => x.id === id)!;
    if (modality === 'ONLINE' && !s.allowsOnline) setModality('PRESENCIAL');
    if (modality === 'PRESENCIAL' && !s.allowsInPerson) setModality('ONLINE');
    setStartsAt(undefined);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Tipo de atendimento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickService(s.id)}
              aria-pressed={s.id === serviceId}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                s.id === serviceId ? 'border-primary bg-accent' : 'bg-card hover:bg-muted',
              )}
            >
              <span className="block font-medium">{s.name}</span>
              <span className="block text-sm text-muted-foreground">
                {s.durationMinutes} min{s.description ? ` · ${s.description}` : ''}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Modalidade</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {(
            [
              { v: 'PRESENCIAL', label: 'Presencial', icon: MapPin, ok: service?.allowsInPerson },
              { v: 'ONLINE', label: 'Online', icon: Monitor, ok: service?.allowsOnline },
            ] as const
          ).map(({ v, label, icon: Icon, ok }) => (
            <button
              key={v}
              type="button"
              disabled={!ok}
              aria-pressed={modality === v}
              onClick={() => {
                setModality(v);
                setStartsAt(undefined);
              }}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-3 font-medium transition-colors disabled:opacity-40',
                modality === v ? 'border-primary bg-accent' : 'bg-card hover:bg-muted',
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          ))}
        </CardContent>
      </Card>

      {service && (
        <Card>
          <CardHeader>
            <CardTitle>3. Dia e horário</CardTitle>
          </CardHeader>
          <CardContent>
            <SlotPicker
              serviceTypeId={service.id}
              modality={modality}
              value={startsAt}
              onChange={setStartsAt}
            />
          </CardContent>
        </Card>
      )}

      {startsAt && service && (
        <Card className="border-primary/40 bg-accent/40">
          <CardContent className="space-y-3 p-5">
            <p className="font-medium">Resumo</p>
            <p>
              {service.name} · {modality === 'ONLINE' ? 'Online' : 'Presencial'}
              <br />
              <span className="capitalize">{fmtLongDate(startsAt)}</span> às {fmtTime(startsAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {manualApproval
                ? 'Seu pedido ficará "aguardando confirmação" até a psicóloga aprovar. Você receberá um e-mail.'
                : 'O horário é confirmado imediatamente e você receberá um e-mail.'}{' '}
              Cancelamentos e remarcações pelo sistema são permitidos até {minCancelHours}h antes.
            </p>
            <Button
              size="lg"
              className="w-full"
              loading={pending}
              disabled={disabled}
              onClick={() => execute({ serviceTypeId: service.id, modality, startsAt })}
            >
              {manualApproval ? 'Solicitar este horário' : 'Confirmar agendamento'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
