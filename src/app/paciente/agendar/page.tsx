import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getScheduling } from '@/lib/settings';
import { requirePatient } from '@/server/session';
import { BookingWizard } from './booking-wizard';

export const metadata: Metadata = { title: 'Agendar sessão' };

export default async function BookPage() {
  const user = await requirePatient();
  const [services, scheduling] = await Promise.all([
    db.serviceType.findMany({
      where: { active: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    }),
    getScheduling(),
  ]);
  const meetsRequirements = !!user.emailVerifiedAt && user.patientProfile.status === 'ATIVO';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl">Agendar sessão</h1>
        <p className="text-muted-foreground">
          Escolha o tipo de atendimento, a modalidade e um horário disponível.
        </p>
      </div>
      {!meetsRequirements && (
        <p role="alert" className="rounded-lg bg-warning/10 p-4 text-sm">
          {!user.emailVerifiedAt
            ? 'Confirme seu e-mail para liberar o agendamento.'
            : 'Seu cadastro não está ativo para novos agendamentos. Entre em contato com o consultório.'}
        </p>
      )}
      <BookingWizard
        disabled={!meetsRequirements}
        manualApproval={scheduling.manualApproval}
        minCancelHours={scheduling.minCancelHours}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          allowsOnline: s.allowsOnline,
          allowsInPerson: s.allowsInPerson,
        }))}
      />
    </div>
  );
}
