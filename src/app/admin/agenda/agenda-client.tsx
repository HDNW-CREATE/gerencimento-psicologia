'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import type { DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { fmtDateTime } from '@/lib/format';
import {
  getCalendarDataAction,
  staffMoveAppointmentAction,
  type CalendarEventDTO,
} from '@/server/actions/appointments';
import {
  CreateAppointmentDialog,
  type PackageOpt,
  type PatientOpt,
  type ServiceOpt,
} from './create-dialog';
import { EventDialog } from './event-dialog';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDENTE: { bg: '#f59e0b', fg: '#1f1300' },
  AGENDADA: { bg: '#7a9a8b', fg: '#10231b' },
  CONFIRMADA: { bg: '#2f6b4f', fg: '#ffffff' },
  REALIZADA: { bg: '#4b5a54', fg: '#ffffff' },
  FALTA: { bg: '#b42318', fg: '#ffffff' },
  CANCELADA_PACIENTE: { bg: '#d6d3cc', fg: '#4b4b4b' },
  CANCELADA_PSICOLOGA: { bg: '#d6d3cc', fg: '#4b4b4b' },
  RECUSADA: { bg: '#d6d3cc', fg: '#4b4b4b' },
};
const CANCELLED = ['CANCELADA_PACIENTE', 'CANCELADA_PSICOLOGA', 'RECUSADA'];

interface Props {
  patients: PatientOpt[];
  services: ServiceOpt[];
  packages: PackageOpt[];
  defaultMeetingUrl: string;
  canClinical: boolean;
}

export function AgendaClient({
  patients,
  services,
  packages,
  defaultMeetingUrl,
  canClinical,
}: Props) {
  const calRef = useRef<FullCalendar>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [createFrom, setCreateFrom] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<CalendarEventDTO | null>(null);
  const [drop, setDrop] = useState<{ info: EventDropArg; event: CalendarEventDTO } | null>(null);
  const [dropScope, setDropScope] = useState<'THIS' | 'FOLLOWING'>('THIS');
  const [moving, setMoving] = useState(false);
  const dtoById = useRef(new Map<string, CalendarEventDTO>());

  const refetch = useCallback(() => calRef.current?.getApi().refetchEvents(), []);

  const loadEvents = useCallback(
    async (
      info: { start: Date; end: Date },
      success: (e: EventInput[]) => void,
      failure: (e: Error) => void,
    ) => {
      const r = await getCalendarDataAction({
        start: info.start.toISOString(),
        end: info.end.toISOString(),
      });
      if (!r.ok) {
        toast.error(r.error);
        failure(new Error(r.error));
        return;
      }
      const { events, blocks } = r.data!;
      dtoById.current = new Map(events.map((e) => [e.id, e]));
      const inputs: EventInput[] = events
        .filter((e) => showCancelled || !CANCELLED.includes(e.status))
        .map((e) => {
          const c = STATUS_COLORS[e.status] ?? STATUS_COLORS.AGENDADA!;
          return {
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            backgroundColor: c.bg,
            borderColor: e.modality === 'ONLINE' ? '#1d4ed8' : c.bg,
            textColor: c.fg,
            editable: !['REALIZADA', ...CANCELLED].includes(e.status),
            extendedProps: { dto: e },
            classNames: CANCELLED.includes(e.status) ? ['opacity-60', 'line-through'] : [],
          };
        });
      const bg: EventInput[] = blocks.map((b) => ({
        id: `block-${b.id}`,
        start: b.start,
        end: b.end,
        display: 'background',
        backgroundColor: '#e7d5d0',
        title: b.reason ?? 'Bloqueado',
        editable: false,
      }));
      success([...inputs, ...bg]);
    },
    [showCancelled],
  );

  const onEventClick = (arg: EventClickArg) => {
    const dto = arg.event.extendedProps.dto as CalendarEventDTO | undefined;
    if (dto) setSelected(dto);
  };

  const onEventDrop = (info: EventDropArg) => {
    const dto = info.event.extendedProps.dto as CalendarEventDTO;
    setDropScope('THIS');
    setDrop({ info, event: dto });
  };

  const confirmDrop = async () => {
    if (!drop) return;
    setMoving(true);
    const start = drop.info.event.start!;
    const r = await staffMoveAppointmentAction({
      id: drop.event.id,
      startsAt: start.toISOString(),
      scope: dropScope,
      notify: true,
    });
    setMoving(false);
    if (r.ok) toast.success(r.message);
    else {
      toast.error(r.error);
      drop.info.revert();
    }
    setDrop(null);
    refetch();
  };

  const patientsMap = useMemo(() => new Map(patients.map((p) => [p.id, p.name])), [patients]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {Object.entries({
            PENDENTE: 'Aguardando',
            AGENDADA: 'Agendada',
            CONFIRMADA: 'Confirmada',
            REALIZADA: 'Realizada',
            FALTA: 'Falta',
          }).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span
                className="size-3 rounded-sm"
                style={{ background: STATUS_COLORS[k]!.bg }}
                aria-hidden
              />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm border-2 border-blue-700" aria-hidden /> Online
            (borda azul)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: '#e7d5d0' }} aria-hidden />{' '}
            Bloqueio
          </span>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Mostrar canceladas
          </label>
        </div>
        <Button
          onClick={() => {
            setCreateFrom(null);
            setCreateOpen(true);
          }}
        >
          <Plus /> Nova sessão
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-2 sm:p-4">
        <FullCalendar
          key={String(showCancelled)}
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          locale={ptBrLocale}
          initialView={
            typeof window !== 'undefined' && window.innerWidth < 768
              ? 'timeGridDay'
              : 'timeGridWeek'
          }
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          height="auto"
          contentHeight={720}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          slotDuration="00:30:00"
          nowIndicator
          allDaySlot={false}
          weekends
          editable
          selectable
          selectMirror
          eventDurationEditable={false}
          events={loadEvents}
          eventClick={onEventClick}
          eventDrop={onEventDrop}
          select={(arg) => {
            setCreateFrom(arg.start);
            setCreateOpen(true);
          }}
          datesSet={(_arg: DatesSetArg) => undefined}
          eventContent={(arg) => {
            const dto = arg.event.extendedProps.dto as CalendarEventDTO | undefined;
            if (!dto) return undefined;
            return (
              <div className="overflow-hidden px-0.5 text-[11px] leading-tight">
                <strong>{arg.timeText}</strong> {dto.modality === 'ONLINE' ? '💻' : '📍'}
                <div className="truncate font-medium">{dto.title}</div>
                {arg.view.type !== 'dayGridMonth' && (
                  <div className="truncate opacity-80">{dto.serviceName}</div>
                )}
              </div>
            );
          }}
        />
      </div>

      <CreateAppointmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialStart={createFrom}
        patients={patients}
        services={services}
        packages={packages}
        defaultMeetingUrl={defaultMeetingUrl}
        onCreated={refetch}
      />

      <EventDialog
        event={selected}
        patientName={selected ? (patientsMap.get(selected.patientId) ?? selected.patientName) : ''}
        canClinical={canClinical}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null);
          refetch();
        }}
      />

      <ConfirmDialog
        open={!!drop}
        onOpenChange={(o) => {
          if (!o && drop) {
            drop.info.revert();
            setDrop(null);
          }
        }}
        title="Remarcar esta sessão?"
        description={
          drop && (
            <span>
              <strong>{drop.event.title}</strong> passará para{' '}
              <strong>{fmtDateTime(drop.info.event.start!)}</strong>. O paciente receberá um e-mail
              automático com o novo horário.
            </span>
          )
        }
        confirmLabel="Remarcar e avisar"
        loading={moving}
        onConfirm={confirmDrop}
      >
        {drop?.event.recurrenceId && (
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">Esta sessão faz parte de uma série</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={dropScope === 'THIS'}
                onChange={() => setDropScope('THIS')}
              />{' '}
              Apenas esta sessão
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={dropScope === 'FOLLOWING'}
                onChange={() => setDropScope('FOLLOWING')}
              />{' '}
              Esta e as próximas da série
            </label>
          </fieldset>
        )}
      </ConfirmDialog>
    </div>
  );
}
