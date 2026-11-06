'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useServerAction } from '@/components/forms/use-action';
import { quickCreatePatientAction } from '@/server/actions/patients';
import { staffCreateAppointmentAction } from '@/server/actions/appointments';
import { parseMoneyToCents } from '@/lib/validators';

export interface PatientOpt {
  id: string;
  name: string;
}
export interface ServiceOpt {
  id: string;
  name: string;
  durationMinutes: number;
  allowsOnline: boolean;
  allowsInPerson: boolean;
}
export interface PackageOpt {
  id: string;
  patientId: string;
  name: string;
  remaining: number;
}

/** Valor para <input type="datetime-local"> no horário local do navegador. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialStart: Date | null;
  patients: PatientOpt[];
  services: ServiceOpt[];
  packages: PackageOpt[];
  defaultMeetingUrl: string;
  onCreated: () => void;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  initialStart,
  patients,
  services,
  packages,
  defaultMeetingUrl,
  onCreated,
}: Props) {
  const [patientId, setPatientId] = useState('');
  const [filter, setFilter] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [modality, setModality] = useState<'PRESENCIAL' | 'ONLINE'>('PRESENCIAL');
  const [when, setWhen] = useState('');
  const [status, setStatus] = useState<'AGENDADA' | 'CONFIRMADA'>('CONFIRMADA');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [price, setPrice] = useState('');
  const [packageId, setPackageId] = useState('');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [recur, setRecur] = useState<'' | 'SEMANAL' | 'QUINZENAL'>('');
  const [count, setCount] = useState(8);
  const [quick, setQuick] = useState(false);
  const [qName, setQName] = useState('');
  const [qPhone, setQPhone] = useState('');
  const [qEmail, setQEmail] = useState('');
  const [extraPatients, setExtraPatients] = useState<PatientOpt[]>([]);

  useEffect(() => {
    if (open) {
      const base = initialStart ?? new Date(Date.now() + 24 * 3600_000);
      if (!initialStart) base.setMinutes(0, 0, 0);
      setWhen(toLocalInput(base));
      setMeetingUrl('');
      setPrice('');
      setPackageId('');
      setNote('');
      setRecur('');
    }
  }, [open, initialStart]);

  const all = useMemo(() => [...extraPatients, ...patients], [extraPatients, patients]);
  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? all.filter((p) => p.name.toLowerCase().includes(f)) : all;
  }, [all, filter]);
  const patientPackages = packages.filter((p) => p.patientId === patientId);
  const service = services.find((s) => s.id === serviceId);

  const quickCreate = useServerAction(quickCreatePatientAction, {
    onSuccess: (r) => {
      if (r.data) {
        setExtraPatients((x) => [{ id: r.data!.id, name: r.data!.name }, ...x]);
        setPatientId(r.data.id);
        setQuick(false);
        setQName('');
        setQPhone('');
        setQEmail('');
      }
    },
  });

  const create = useServerAction(staffCreateAppointmentAction, {
    onSuccess: () => {
      onOpenChange(false);
      onCreated();
    },
  });

  const submit = () => {
    const cents = price ? parseMoneyToCents(price) : undefined;
    create.execute({
      patientId,
      serviceTypeId: serviceId,
      startsAt: new Date(when).toISOString(),
      modality,
      meetingUrl: modality === 'ONLINE' ? meetingUrl : '',
      status,
      priceCents: cents ?? undefined,
      packageId,
      adminNote: note,
      notifyPatient: notify,
      recurrence: recur ? { frequency: recur, count } : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova sessão</DialogTitle>
          <DialogDescription>Crie uma sessão avulsa ou uma série recorrente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-filter">Paciente</Label>
            {!quick ? (
              <>
                <Input
                  id="c-filter"
                  placeholder="Buscar pelo nome…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <NativeSelect
                  aria-label="Selecionar paciente"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  size={1}
                >
                  <option value="">Selecione…</option>
                  {visible.slice(0, 200).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                <button
                  type="button"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => setQuick(true)}
                >
                  + Cadastro rápido (paciente sem conta)
                </button>
              </>
            ) : (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Input
                  placeholder="Nome completo"
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  aria-label="Nome completo"
                />
                <Input
                  placeholder="Telefone (opcional)"
                  value={qPhone}
                  onChange={(e) => setQPhone(e.target.value)}
                  aria-label="Telefone"
                />
                <Input
                  placeholder="E-mail (opcional, para avisos)"
                  value={qEmail}
                  onChange={(e) => setQEmail(e.target.value)}
                  aria-label="E-mail"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={quickCreate.pending}
                    onClick={() =>
                      quickCreate.execute({ fullName: qName, phone: qPhone, email: qEmail })
                    }
                  >
                    Cadastrar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuick(false)}>
                    Voltar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-service">Serviço</Label>
              <NativeSelect
                id="c-service"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min)
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-mod">Modalidade</Label>
              <NativeSelect
                id="c-mod"
                value={modality}
                onChange={(e) => setModality(e.target.value as 'PRESENCIAL' | 'ONLINE')}
              >
                <option value="PRESENCIAL" disabled={service ? !service.allowsInPerson : false}>
                  Presencial
                </option>
                <option value="ONLINE" disabled={service ? !service.allowsOnline : false}>
                  Online
                </option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-when">Data e hora</Label>
              <Input
                id="c-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-status">Situação</Label>
              <NativeSelect
                id="c-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'AGENDADA' | 'CONFIRMADA')}
              >
                <option value="CONFIRMADA">Confirmada</option>
                <option value="AGENDADA">Agendada</option>
              </NativeSelect>
            </div>
          </div>

          {modality === 'ONLINE' && (
            <div className="space-y-1.5">
              <Label htmlFor="c-url">Link da sessão online</Label>
              <Input
                id="c-url"
                type="url"
                placeholder={defaultMeetingUrl || 'https://meet.google.com/…'}
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Em branco = usa o link padrão das configurações.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-rec">Repetir</Label>
              <NativeSelect
                id="c-rec"
                value={recur}
                onChange={(e) => setRecur(e.target.value as '' | 'SEMANAL' | 'QUINZENAL')}
              >
                <option value="">Não repetir</option>
                <option value="SEMANAL">Toda semana</option>
                <option value="QUINZENAL">A cada 15 dias</option>
              </NativeSelect>
            </div>
            {recur && (
              <div className="space-y-1.5">
                <Label htmlFor="c-count">Quantidade de sessões</Label>
                <Input
                  id="c-count"
                  type="number"
                  min={2}
                  max={52}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="c-price">Valor (opcional)</Label>
              <Input
                id="c-price"
                inputMode="decimal"
                placeholder="Padrão do paciente/serviço"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {patientPackages.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="c-pkg">Usar pacote</Label>
                <NativeSelect
                  id="c-pkg"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                >
                  <option value="">Não usar</option>
                  {patientPackages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (restam {p.remaining})
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-note">Observação administrativa (não clínica)</Label>
            <Textarea
              id="c-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-16"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Avisar o paciente por e-mail (com arquivo para a agenda)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            loading={create.pending}
            disabled={!patientId || !serviceId || !when}
          >
            {recur ? `Criar ${count} sessões` : 'Criar sessão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
