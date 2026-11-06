import { Video, MapPin } from 'lucide-react';
import type { Appointment, ServiceType } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { canShowMeetingLink, evaluateCancellation, isOpenStatus } from '@/lib/domain/policies';
import { fmtDate, fmtTime, modalityLabels } from '@/lib/format';
import { SessionActions } from './session-actions';

interface Props {
  appointment: Appointment & { serviceType: ServiceType };
  now: Date;
  minCancelHours: number;
  meetingMinutesBefore: number;
  defaultMeetingUrl: string;
  address: string;
  contactHint: string;
  featured?: boolean;
}

/** Cartão de sessão. O link online só é entregue ao navegador perto do horário. */
export function AppointmentCard({
  appointment: a,
  now,
  minCancelHours,
  meetingMinutesBefore,
  defaultMeetingUrl,
  address,
  contactHint,
  featured,
}: Props) {
  const open = isOpenStatus(a.status) && a.startsAt > now;
  const within = evaluateCancellation(a.startsAt, now, minCancelHours).allowed;
  const showLink =
    a.modality === 'ONLINE' &&
    isOpenStatus(a.status) &&
    canShowMeetingLink(a.startsAt, a.endsAt, now, meetingMinutesBefore);
  const link = a.meetingUrl || defaultMeetingUrl;

  return (
    <Card
      className={
        featured ? 'border-primary/40 bg-gradient-to-br from-accent/60 to-card' : undefined
      }
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm capitalize text-muted-foreground">
              {fmtDate(a.startsAt, "EEEE, dd 'de' MMMM")}
            </p>
            <p className="font-serif text-3xl leading-tight">{fmtTime(a.startsAt)}</p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">{a.serviceType.name}</span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {a.modality === 'ONLINE' ? (
              <Video className="size-4" aria-hidden />
            ) : (
              <MapPin className="size-4" aria-hidden />
            )}
            {modalityLabels[a.modality]}
            {a.modality === 'PRESENCIAL' && address ? ` · ${address}` : ''}
          </span>
        </div>

        {a.status === 'PENDENTE' && (
          <p className="rounded-lg bg-warning/10 p-3 text-sm">
            Aguardando confirmação da psicóloga. Você será avisado por e-mail.
          </p>
        )}

        {showLink && link && (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Video /> Entrar na sessão online
            </a>
          </Button>
        )}
        {a.modality === 'ONLINE' && open && !showLink && (
          <p className="text-xs text-muted-foreground">
            O link da sessão online aparece aqui {meetingMinutesBefore} minutos antes do horário.
          </p>
        )}

        {open && (
          <SessionActions
            appointmentId={a.id}
            serviceTypeId={a.serviceTypeId}
            modality={a.modality}
            startsAtIso={a.startsAt.toISOString()}
            withinDeadline={within}
            minCancelHours={minCancelHours}
            contactHint={contactHint}
          />
        )}
      </CardContent>
    </Card>
  );
}
