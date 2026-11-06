import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { requirePermission } from '@/server/session';
import { RequestCard } from './request-card';

export const metadata: Metadata = { title: 'Solicitações LGPD' };

export default async function LgpdPage() {
  await requirePermission('lgpd.manage');
  const requests = await db.dataRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Solicitações LGPD</h1>
        <p className="text-muted-foreground">
          Pedidos de cópia e exclusão de dados. Prazo recomendado de resposta: 15 dias. O prontuário
          deve ser guardado por, no mínimo, 5 anos (CFP).
        </p>
      </div>
      {requests.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Nenhuma solicitação.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {requests.map((r) => (
          <RequestCard
            key={r.id}
            req={{
              id: r.id,
              type: r.type,
              status: r.status,
              message: r.message,
              resolutionNote: r.resolutionNote,
              createdLabel: fmtDateTime(r.createdAt),
              resolvedLabel: r.resolvedAt ? fmtDateTime(r.resolvedAt) : null,
              userName: r.user.name,
              userEmail: r.user.email,
            }}
          />
        ))}
      </div>
    </div>
  );
}
