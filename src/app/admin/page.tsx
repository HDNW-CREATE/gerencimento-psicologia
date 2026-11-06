import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CalendarCheck, FileLock2, MailWarning, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { fmtDate, fmtTime, formatBRL, modalityLabels } from '@/lib/format';
import { can } from '@/lib/permissions';
import { loadDashboard } from '@/server/dashboard';
import { requirePermission } from '@/server/session';
import { EvolutionCharts } from './evolution-chart';

export const metadata: Metadata = { title: 'Painel' };

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const color =
    tone === 'ok'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-[hsl(30_80%_32%)]'
        : tone === 'bad'
          ? 'text-destructive'
          : '';
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-serif text-3xl ${color}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboard() {
  const user = await requirePermission('agenda.manage');
  const d = await loadDashboard();
  const pendencias = d.awaiting.length + d.overdue.length + d.lgpd + d.unverified;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Olá, {user.name.split(' ')[0]}</h1>
        <p className="text-muted-foreground">Resumo do consultório.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="size-5 text-primary" aria-hidden /> Sessões de hoje
            </CardTitle>
            <CardDescription>
              {d.todayList.length} sessão(ões) hoje · {d.weekCount} nesta semana
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {d.todayList.length === 0 && (
                <li className="py-4 text-sm text-muted-foreground">Nenhuma sessão hoje.</li>
              )}
              {d.todayList.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex items-center gap-4">
                    <span className="font-serif text-xl">{fmtTime(a.startsAt)}</span>
                    <div>
                      <Link
                        href={`/admin/pacientes/${a.patient.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {a.patient.socialName ?? a.patient.fullName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {a.serviceType.name} · {modalityLabels[a.modality]}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" aria-hidden /> Pendências ({pendencias}
              )
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {pendencias === 0 && <p className="text-muted-foreground">Tudo em dia. 🎉</p>}
            {d.awaiting.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Agendamentos aguardando sua aprovação</p>
                <ul className="space-y-1">
                  {d.awaiting.map((a) => (
                    <li key={a.id}>
                      <Link className="text-primary hover:underline" href="/admin/agenda">
                        {a.patient.socialName ?? a.patient.fullName} ·{' '}
                        {fmtDate(a.startsAt, "dd/MM 'às' HH:mm")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.overdue.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Pagamentos atrasados</p>
                <ul className="space-y-1">
                  {d.overdue.map((p) => (
                    <li key={p.id}>
                      <Link
                        className="text-primary hover:underline"
                        href={`/admin/pacientes/${p.patient.id}`}
                      >
                        {p.patient.socialName ?? p.patient.fullName}
                      </Link>{' '}
                      · {formatBRL(p.amountCents)} · sessão de {fmtDate(p.appointment!.startsAt)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {can(user.role, 'lgpd.manage') && d.lgpd > 0 && (
              <p className="flex items-center gap-2">
                <FileLock2 className="size-4" aria-hidden />
                <Link className="text-primary hover:underline" href="/admin/lgpd">
                  {d.lgpd} solicitação(ões) LGPD em aberto
                </Link>
              </p>
            )}
            {d.unverified > 0 && (
              <p className="flex items-center gap-2">
                <MailWarning className="size-4" aria-hidden />
                <Link className="text-primary hover:underline" href="/admin/pacientes">
                  {d.unverified} paciente(s) com e-mail não confirmado
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-label="Indicadores do mês" className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl">
          <UserCheck className="size-5 text-primary" aria-hidden /> Indicadores do mês
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Sessões realizadas" value={d.month.realizadas} />
          <Kpi label="Faltas" value={d.month.faltas} tone={d.month.faltas ? 'bad' : undefined} />
          <Kpi label="Cancelamentos" value={d.month.canceladas} />
          <Kpi label="Novos pacientes" value={d.month.novos} />
          <Kpi label="Recebido" value={formatBRL(d.month.receivedCents)} tone="ok" />
          <Kpi
            label="A receber"
            value={formatBRL(d.month.toReceiveCents)}
            tone="warn"
            hint="pendente do mês"
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolução mensal</CardTitle>
          <CardDescription>Últimos 6 meses.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvolutionCharts data={d.series} />
        </CardContent>
      </Card>
    </div>
  );
}
