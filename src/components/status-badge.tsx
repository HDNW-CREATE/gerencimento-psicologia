import { Badge } from '@/components/ui/badge';
import { paymentStatusLabels, statusLabels } from '@/lib/format';

const variant = {
  PENDENTE: 'warning',
  AGENDADA: 'secondary',
  CONFIRMADA: 'success',
  REALIZADA: 'default',
  FALTA: 'destructive',
  CANCELADA_PACIENTE: 'muted',
  CANCELADA_PSICOLOGA: 'muted',
  RECUSADA: 'muted',
} as const;

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={variant[status as keyof typeof variant] ?? 'outline'}>
      {statusLabels[status] ?? status}
    </Badge>
  );
}

const payVariant = { PENDENTE: 'warning', PAGO: 'success', ISENTO: 'muted' } as const;

export function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge variant={payVariant[status as keyof typeof payVariant] ?? 'outline'}>
      {paymentStatusLabels[status] ?? status}
    </Badge>
  );
}
