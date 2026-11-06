import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PaymentBadge } from '@/components/status-badge';
import { db } from '@/lib/db';
import { fmtDate, formatBRL, paymentMethodLabels } from '@/lib/format';
import { requirePatient } from '@/server/session';

export const metadata: Metadata = { title: 'Financeiro' };

export default async function PatientFinancePage() {
  const user = await requirePatient();
  // Sempre filtrado pelo paciente da sessão
  const payments = await db.payment.findMany({
    where: { patientId: user.patientProfile.id },
    include: { appointment: { include: { serviceType: true } }, package: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const pending = payments
    .filter((p) => p.status === 'PENDENTE' && p.amountCents > 0)
    .reduce((s, p) => s + p.amountCents, 0);
  const paidTotal = payments
    .filter((p) => p.status === 'PAGO')
    .reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Financeiro</h1>
        <p className="text-muted-foreground">
          Acompanhe seus pagamentos e baixe os recibos (úteis para reembolso e Imposto de Renda).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pendente</p>
            <p className="font-serif text-3xl text-[hsl(30_80%_32%)]">{formatBRL(pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total pago</p>
            <p className="font-serif text-3xl text-success">{formatBRL(paidTotal)}</p>
          </CardContent>
        </Card>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {payments.length === 0 && (
          <li className="p-6 text-center text-muted-foreground">Nenhum lançamento ainda.</li>
        )}
        {payments.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {p.appointment
                  ? `${p.appointment.serviceType.name} · ${fmtDate(p.appointment.startsAt)}`
                  : (p.package?.name ?? p.notes ?? 'Lançamento')}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatBRL(p.amountCents)}
                {p.paidAt
                  ? ` · pago em ${fmtDate(p.paidAt)}${p.method ? ` (${paymentMethodLabels[p.method]})` : ''}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PaymentBadge status={p.status} />
              {p.status === 'PAGO' && (
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/recibos/${p.id}`}>
                    <Download /> Recibo
                  </a>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
