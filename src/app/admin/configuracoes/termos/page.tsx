import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { LegalEditor } from './legal-editor';

export const metadata: Metadata = { title: 'Termos e privacidade' };

const TYPES = [
  { type: 'TERMO_CONSENTIMENTO', label: 'Termo de Consentimento' },
  { type: 'POLITICA_PRIVACIDADE', label: 'Política de Privacidade' },
  { type: 'TERMOS_DE_USO', label: 'Termos de Uso' },
] as const;

export default async function LegalPage() {
  const docs = await Promise.all(
    TYPES.map(async (t) => {
      const latest = await db.legalDocument.findFirst({
        where: { type: t.type },
        orderBy: { version: 'desc' },
      });
      const accepted = latest
        ? await db.consentAcceptance.count({ where: { legalDocumentId: latest.id } })
        : 0;
      return {
        ...t,
        title: latest?.title ?? t.label,
        content: latest?.content ?? '',
        version: latest?.version ?? 0,
        accepted,
      };
    }),
  );
  return (
    <div className="space-y-6">
      <p className="rounded-lg bg-warning/10 p-4 text-sm">
        <strong>Importante:</strong> os textos iniciais são modelos genéricos. Peça a revisão de um
        profissional do direito antes de usar com pacientes reais. Ao publicar uma nova versão,
        todos os pacientes precisarão aceitá-la no próximo acesso.
      </p>
      {docs.map((d) => (
        <LegalEditor key={d.type} {...d} />
      ))}
    </div>
  );
}
