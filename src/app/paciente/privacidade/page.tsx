import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { requirePatient } from '@/server/session';
import { DataRequestForm } from './data-request-form';

export const metadata: Metadata = { title: 'Privacidade e meus dados' };

const statusLabel = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  CONCLUIDA: 'Concluída',
  NEGADA: 'Negada',
} as const;

export default async function PrivacyPage() {
  const user = await requirePatient();
  const [requests, consents] = await Promise.all([
    db.dataRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
    db.consentAcceptance.findMany({
      where: { userId: user.id },
      include: { legalDocument: true },
      orderBy: { acceptedAt: 'desc' },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl">Privacidade e meus dados</h1>
        <p className="text-muted-foreground">
          Seus direitos previstos na LGPD. Leia a nossa{' '}
          <Link href="/privacidade" className="text-primary underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fazer um pedido</CardTitle>
          <CardDescription>A psicóloga analisa cada pedido e responde por e-mail.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataRequestForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meus pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {requests.length === 0 && (
              <li className="py-2 text-sm text-muted-foreground">Nenhum pedido registrado.</li>
            )}
            {requests.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.type === 'EXPORTACAO' ? 'Cópia dos meus dados' : 'Exclusão da conta'}
                  </span>
                  <Badge
                    variant={
                      r.status === 'CONCLUIDA'
                        ? 'success'
                        : r.status === 'NEGADA'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {statusLabel[r.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pedido em {fmtDateTime(r.createdAt)}
                </p>
                {r.resolutionNote && <p className="mt-1">Resposta: {r.resolutionNote}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meus aceites</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {consents.map((c) => (
              <li key={c.id}>
                {c.legalDocument.title} (v{c.legalDocument.version}) — {fmtDateTime(c.acceptedAt)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
