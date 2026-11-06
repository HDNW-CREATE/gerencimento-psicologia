import type { Metadata } from 'next';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { fmtDate } from '@/lib/format';
import { requirePatient } from '@/server/session';

export const metadata: Metadata = { title: 'Documentos' };

export default async function PatientDocumentsPage() {
  const user = await requirePatient();
  // Somente documentos DESTE paciente e marcados como compartilhados
  const docs = await db.document.findMany({
    where: { patientId: user.patientProfile.id, sharedWithPatient: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Documentos</h1>
        <p className="text-muted-foreground">
          Arquivos compartilhados pela psicóloga (declarações, atestados etc.).
        </p>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {docs.length === 0 && (
          <li className="p-6 text-center text-muted-foreground">Nenhum documento disponível.</li>
        )}
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-primary" aria-hidden />
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-sm text-muted-foreground">{fmtDate(d.createdAt)}</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={`/api/documents/${d.id}`}>
                <Download /> Baixar
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
