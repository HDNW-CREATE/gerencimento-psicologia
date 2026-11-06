'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate, fmtTime } from '@/lib/format';
import { getSlotsAction, type SlotDTO } from '@/server/actions/appointments';
import { addDaysYmd, utcToLocalYmd } from '@/lib/domain/time';

interface SlotPickerProps {
  serviceTypeId: string;
  modality: 'PRESENCIAL' | 'ONLINE';
  excludeAppointmentId?: string;
  value?: string; // ISO selecionado
  onChange: (iso: string | undefined) => void;
  /** Quantos dias à frente consultar (padrão 45). */
  days?: number;
}

/** Seletor de dia + horário. Só mostra horários realmente livres (calculados no servidor). */
export function SlotPicker({
  serviceTypeId,
  modality,
  excludeAppointmentId,
  value,
  onChange,
  days = 45,
}: SlotPickerProps) {
  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setError(null);
    onChange(undefined);
    const from = utcToLocalYmd(new Date());
    getSlotsAction({
      serviceTypeId,
      modality,
      fromYmd: from,
      toYmd: addDaysYmd(from, days),
      excludeAppointmentId,
    }).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setSlots(r.data ?? []);
        setDay(r.data?.[0] ? utcToLocalYmd(new Date(r.data[0].startsAt)) : undefined);
      } else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypeId, modality, excludeAppointmentId, days]);

  const byDay = useMemo(() => {
    const map = new Map<string, SlotDTO[]>();
    for (const s of slots ?? []) {
      const k = utcToLocalYmd(new Date(s.startsAt));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return map;
  }, [slots]);

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (!slots)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando horários disponíveis…
      </p>
    );
  if (slots.length === 0)
    return (
      <p role="status" className="rounded-lg bg-muted p-4 text-sm">
        Não há horários disponíveis nas próximas semanas para esta opção. Tente outra modalidade ou
        entre em contato com o consultório.
      </p>
    );

  const days_ = [...byDay.keys()];
  const times = day ? (byDay.get(day) ?? []) : [];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">Escolha o dia</p>
        <div
          role="listbox"
          aria-label="Dias disponíveis"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
        >
          {days_.map((d) => {
            const dt = new Date(byDay.get(d)![0]!.startsAt);
            const active = d === day;
            return (
              <button
                key={d}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setDay(d);
                  onChange(undefined);
                }}
                className={cn(
                  'flex min-h-16 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent',
                )}
              >
                <span className="text-[11px] uppercase">{fmtDate(dt, 'EEE')}</span>
                <span className="text-lg font-semibold leading-none">{fmtDate(dt, 'dd')}</span>
                <span className="text-[11px] uppercase">{fmtDate(dt, 'MMM')}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Escolha o horário</p>
        <div
          role="listbox"
          aria-label="Horários disponíveis"
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          {times.map((s) => {
            const active = s.startsAt === value;
            return (
              <button
                key={s.startsAt}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onChange(s.startsAt)}
                className={cn(
                  'min-h-11 rounded-lg border px-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent',
                )}
              >
                {fmtTime(s.startsAt)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
