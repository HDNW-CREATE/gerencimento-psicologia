import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { can } from '@/lib/permissions';
import { getScheduling } from '@/lib/settings';
import { requirePermission } from '@/server/session';
import { AgendaClient } from './agenda-client';

export const metadata: Metadata = { title: 'Agenda' };

export default async function AgendaPage() {
  const user = await requirePermission('agenda.manage');
  const [patients, services, packages, scheduling] = await Promise.all([
    db.patientProfile.findMany({
      where: { deletedAt: null, status: { not: 'ALTA' } },
      select: { id: true, fullName: true, socialName: true },
      orderBy: { fullName: 'asc' },
      take: 2000,
    }),
    db.serviceType.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.sessionPackage.findMany({
      where: { cancelledAt: null },
      include: {
        _count: {
          select: {
            appointments: {
              where: {
                status: { notIn: ['CANCELADA_PACIENTE', 'CANCELADA_PSICOLOGA', 'RECUSADA'] },
                deletedAt: null,
              },
            },
          },
        },
      },
    }),
    getScheduling(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl">Agenda</h1>
        <p className="text-muted-foreground">
          Clique em um horário para criar uma sessão, ou arraste uma sessão para remarcar.
        </p>
      </div>
      <AgendaClient
        canClinical={can(user.role, 'clinical.read')}
        defaultMeetingUrl={scheduling.defaultMeetingUrl}
        patients={patients.map((p) => ({
          id: p.id,
          name: p.socialName ? `${p.fullName} (${p.socialName})` : p.fullName,
        }))}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          allowsOnline: s.allowsOnline,
          allowsInPerson: s.allowsInPerson,
        }))}
        packages={packages
          .map((p) => ({
            id: p.id,
            patientId: p.patientId,
            name: p.name,
            remaining: p.totalSessions - p._count.appointments,
            expired: !!p.expiresAt && p.expiresAt < new Date(),
          }))
          .filter((p) => p.remaining > 0 && !p.expired)}
      />
    </div>
  );
}
