import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarPlus, FileText, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { formatBRL } from '@/lib/format';
import { requirePatient } from '@/server/session';
import { getPatientViewContext } from '@/server/patient-context';
import { AppointmentCard } from './sessoes/appointment-card';

export const metadata: Metadata = { title: 'Início' };

export default async function PatientHome() {
  const user = await requirePatient();
  const ctx = await getPatientViewContext();
  const patientId = user.patientProfile.id;

  const [next, pendingPayments, docCount] = await Promise.all([
    db.appointment.findFirst({
      where: {
        patientId,
        deletedAt: null,
        status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA'] },
        endsAt: { gt: ctx.now },
      },
      include: { serviceType: true },
      orderBy: { startsAt: 'asc' },
    }),
    db.payment.aggregate({
      where: { patientId, status: 'PENDENTE', amountCents: { gt: 0 } },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.document.count({ where: { patientId, sharedWithPatient: true, deletedAt: null } }),
  ]);

  const firstName = (user.patientProfile.socialName ?? user.patientProfile.fullName).split(' ')[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Olá, {firstName}</h1>
        <p className="text-muted-foreground">Que bom ter você aqui.</p>
      </div>

      <section aria-labelledby="prox">
        <h2 id="prox" className="mb-3 text-xl">
          Sua próxima sessão
        </h2>
        {next ? (
          <AppointmentCard appointment={next} {...ctx} featured />
        ) : (
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <p className="text-muted-foreground">Você ainda não tem uma sessão agendada.</p>
              <Button asChild size="lg">
                <Link href="/paciente/agendar">Agendar sessão</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-label="Atalhos" className="grid gap-3 sm:grid-cols-3">
        <Shortcut
          href="/paciente/agendar"
          icon={<CalendarPlus />}
          title="Agendar"
          text="Escolher um novo horário"
        />
        <Shortcut
          href="/paciente/financeiro"
          icon={<Wallet />}
          title="Financeiro"
          text={
            pendingPayments._count
              ? `${formatBRL(pendingPayments._sum.amountCents)} pendente`
              : 'Tudo em dia'
          }
        />
        <Shortcut
          href="/paciente/documentos"
          icon={<FileText />}
          title="Documentos"
          text={docCount ? `${docCount} disponível(is)` : 'Nenhum documento'}
        />
      </section>
    </div>
  );
}

function Shortcut({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary [&_svg]:size-5">
        {icon}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}
