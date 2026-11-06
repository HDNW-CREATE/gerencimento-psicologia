import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { requirePatient } from '@/server/session';
import { getPatientViewContext } from '@/server/patient-context';
import { AppointmentCard } from './appointment-card';
import { StatusBadge } from '@/components/status-badge';
import { fmtDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Minhas sessões' };

export default async function SessionsPage() {
  const user = await requirePatient();
  const ctx = await getPatientViewContext();

  // Sempre filtrado pelo paciente logado (nunca por ID vindo da URL)
  const all = await db.appointment.findMany({
    where: { patientId: user.patientProfile.id, deletedAt: null },
    include: { serviceType: true },
    orderBy: { startsAt: 'asc' },
  });
  const upcoming = all.filter(
    (a) => a.startsAt > ctx.now && ['PENDENTE', 'AGENDADA', 'CONFIRMADA'].includes(a.status),
  );
  const history = all.filter((a) => !upcoming.includes(a)).reverse();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Minhas sessões</h1>
          <p className="text-muted-foreground">Acompanhe, remarque ou cancele seus atendimentos.</p>
        </div>
        <Button asChild>
          <Link href="/paciente/agendar">Agendar nova sessão</Link>
        </Button>
      </div>

      <section aria-labelledby="proximas">
        <h2 id="proximas" className="mb-3 text-xl">
          Próximas
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            Você não tem sessões futuras agendadas.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} {...ctx} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="historico">
        <h2 id="historico" className="mb-3 text-xl">
          Histórico
        </h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Ainda não há sessões anteriores.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{a.serviceType.name}</p>
                  <p className="text-sm text-muted-foreground">{fmtDateTime(a.startsAt)}</p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
