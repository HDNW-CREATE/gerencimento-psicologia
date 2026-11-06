import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Download, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { getAnamnesisConfig } from '@/lib/settings';
import { getAnamnesis, listRecords } from '@/server/clinical';
import { requirePermission } from '@/server/session';
import { AnamnesisForm } from './anamnesis-form';
import { NewRecordForm } from './new-record-form';
import { RecordCard } from './record-card';

export const metadata: Metadata = { title: 'Prontuário', robots: { index: false } };

export default async function ClinicalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessao?: string }>;
}) {
  // BARREIRA: somente quem tem `clinical.read` (ADMIN). SECRETARIA é redirecionada.
  await requirePermission('clinical.read');
  const { id } = await params;
  const { sessao } = await searchParams;

  const patient = await db.patientProfile.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, fullName: true, socialName: true },
  });
  if (!patient) notFound();

  const [records, anamnesis, config, appts] = await Promise.all([
    listRecords(id),
    getAnamnesis(id),
    getAnamnesisConfig(),
    db.appointment.findMany({
      where: {
        patientId: id,
        deletedAt: null,
        clinicalRecord: null,
        status: { in: ['REALIZADA', 'CONFIRMADA', 'AGENDADA', 'FALTA'] },
      },
      orderBy: { startsAt: 'desc' },
      take: 40,
      select: { id: true, startsAt: true, status: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/pacientes/${id}`} className="text-sm text-primary hover:underline">
          ← Ficha do paciente
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl">Prontuário · {patient.socialName ?? patient.fullName}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden /> Conteúdo criptografado. Visível somente para
              você. Cada acesso é registrado.
            </p>
          </div>
          <Button asChild variant="outline">
            <a href={`/api/export/prontuario/${id}`}>
              <Download /> Exportar PDF
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="evolucao">
        <TabsList>
          <TabsTrigger value="evolucao">Evoluções ({records.length})</TabsTrigger>
          <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao" className="space-y-6">
          <NewRecordForm
            patientId={id}
            defaultAppointmentId={sessao}
            appointments={appts.map((a) => ({ id: a.id, label: fmtDateTime(a.startsAt) }))}
          />
          <section aria-label="Registros" className="space-y-4">
            {records.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                Nenhuma evolução registrada.
              </p>
            )}
            {records.map((r) => (
              <RecordCard
                key={r.id}
                patientId={id}
                record={{
                  id: r.id,
                  title: r.title,
                  html: r.html,
                  version: r.version,
                  retracted: !!r.retractedAt,
                  retractedReason: r.retractedReason,
                  sessionLabel: r.sessionDate ? fmtDateTime(r.sessionDate) : null,
                  createdLabel: fmtDateTime(r.createdAt),
                  updatedLabel: fmtDateTime(r.updatedAt),
                }}
              />
            ))}
          </section>
        </TabsContent>

        <TabsContent value="anamnese">
          <AnamnesisForm
            patientId={id}
            fields={config.fields}
            initial={anamnesis?.data ?? {}}
            meta={
              anamnesis
                ? `Versão ${anamnesis.version} · atualizada em ${fmtDateTime(anamnesis.updatedAt)}`
                : 'Ainda não preenchida'
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
