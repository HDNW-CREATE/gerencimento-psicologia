import type { Metadata } from 'next';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, NativeSelect } from '@/components/ui/input';
import { PaymentBadge } from '@/components/status-badge';
import { PaymentActions } from '@/components/payment-actions';
import { fmtDate, formatBRL, paymentMethodLabels } from '@/lib/format';
import { isValidYmd } from '@/lib/domain/time';
import { defaultPeriod, financeSummary, listFinance } from '@/server/finance-queries';
import { requirePermission } from '@/server/session';

export const metadata: Metadata = { title: 'Financeiro' };

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; q?: string }>;
}) {
  await requirePermission('finance.manage');
  const sp = await searchParams;
  const def = defaultPeriod();
  const fromYmd = sp.from && isValidYmd(sp.from) ? sp.from : def.fromYmd;
  const toYmd = sp.to && isValidYmd(sp.to) ? sp.to : def.toYmd;
  const status = ['PENDENTE', 'PAGO', 'ISENTO'].includes(sp.status ?? '')
    ? (sp.status as 'PENDENTE' | 'PAGO' | 'ISENTO')
    : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const filter = { fromYmd, toYmd, status, q };

  const [rows, summary] = await Promise.all([listFinance(filter), financeSummary(filter)]);
  const csvHref = `/api/export/financeiro?${new URLSearchParams({ from: fromYmd, to: toYmd, ...(status ? { status } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Financeiro</h1>
          <p className="text-muted-foreground">
            Controle manual de pagamentos. Preparado para Pix online no futuro.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={csvHref}>
            <Download /> Exportar CSV (Excel)
          </a>
        </Button>
      </div>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <label className="space-y-1 text-sm">
          De
          <Input type="date" name="from" defaultValue={fromYmd} className="w-40" />
        </label>
        <label className="space-y-1 text-sm">
          Até
          <Input type="date" name="to" defaultValue={toYmd} className="w-40" />
        </label>
        <label className="space-y-1 text-sm">
          Situação
          <NativeSelect name="status" defaultValue={status ?? ''} className="w-40">
            <option value="">Todas</option>
            <option value="PENDENTE">Pendentes</option>
            <option value="PAGO">Pagos</option>
            <option value="ISENTO">Isentos</option>
          </NativeSelect>
        </label>
        <label className="min-w-48 flex-1 space-y-1 text-sm">
          Paciente
          <Input name="q" defaultValue={q ?? ''} placeholder="Nome…" />
        </label>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Recebido no período</p>
            <p className="font-serif text-3xl text-success">{formatBRL(summary.receivedCents)}</p>
            <p className="text-xs text-muted-foreground">{summary.receivedCount} pagamento(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">A receber (pendente)</p>
            <p className="font-serif text-3xl text-[hsl(30_80%_32%)]">
              {formatBRL(summary.pendingCents)}
            </p>
            <p className="text-xs text-muted-foreground">{summary.pendingCount} lançamento(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Isentos</p>
            <p className="font-serif text-3xl">{summary.waivedCount}</p>
            <p className="text-xs text-muted-foreground">canceladas, faltas não cobradas etc.</p>
          </CardContent>
        </Card>
      </section>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Referência</th>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Pagamento</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum lançamento no período.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  {p.appointment ? (
                    <>
                      {fmtDate(p.appointment.startsAt)}
                      <span className="block text-xs text-muted-foreground">
                        {p.appointment.serviceType.name}
                      </span>
                    </>
                  ) : (
                    <>
                      {fmtDate(p.createdAt)}
                      <span className="block text-xs text-muted-foreground">
                        {p.package ? p.package.name : (p.notes ?? 'Avulso')}
                      </span>
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="text-primary hover:underline"
                    href={`/admin/pacientes/${p.patient.id}`}
                  >
                    {p.patient.socialName ?? p.patient.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{formatBRL(p.amountCents)}</td>
                <td className="px-4 py-3">
                  <PaymentBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.paidAt
                    ? `${fmtDate(p.paidAt)} · ${p.method ? paymentMethodLabels[p.method] : ''}`
                    : '—'}
                </td>
                <td className="flex items-center justify-end gap-1 px-4 py-3">
                  {p.status === 'PAGO' && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={`/api/recibos/${p.id}`}>Recibo</a>
                    </Button>
                  )}
                  <PaymentActions payment={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 500 && (
        <p className="text-xs text-muted-foreground">
          Mostrando os 500 lançamentos mais recentes. Refine o período para ver outros.
        </p>
      )}
    </div>
  );
}
