import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { requirePermission } from '@/server/session';

export const metadata: Metadata = { title: 'Auditoria' };

const PAGE = 50;
const GROUPS: Record<string, string[]> = {
  login: [
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'LOGIN_LOCKED',
    'LOGOUT_ALL',
    'PASSWORD_RESET_REQUEST',
    'PASSWORD_RESET_DONE',
    'PASSWORD_CHANGED',
    'REGISTER',
    'EMAIL_VERIFIED',
  ],
  prontuario: [
    'CLINICAL_RECORD_READ',
    'CLINICAL_RECORD_CREATE',
    'CLINICAL_RECORD_UPDATE',
    'CLINICAL_RECORD_RETRACT',
    'CLINICAL_RECORD_EXPORT',
    'ANAMNESIS_READ',
    'ANAMNESIS_UPDATE',
  ],
  financeiro: ['PAYMENT_UPDATE', 'PACKAGE_CREATE', 'RECEIPT_ISSUED', 'REPORT_EXPORT'],
  lgpd: [
    'DATA_REQUEST_CREATE',
    'DATA_REQUEST_UPDATE',
    'DATA_EXPORT',
    'DOCUMENT_DOWNLOAD',
    'DOCUMENT_UPLOAD',
    'DOCUMENT_DELETE',
  ],
  config: [
    'SETTINGS_UPDATE',
    'SITE_CONTENT_UPDATE',
    'LEGAL_DOCUMENT_PUBLISH',
    'AVAILABILITY_UPDATE',
  ],
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; q?: string; page?: string }>;
}) {
  await requirePermission('audit.read');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const group = sp.g && GROUPS[sp.g] ? sp.g : '';
  const q = sp.q?.trim().slice(0, 60);

  const where: Prisma.AuditLogWhereInput = {
    ...(group ? { action: { in: GROUPS[group] } } : {}),
    ...(q
      ? {
          OR: [{ action: { contains: q.toUpperCase() } }, { ip: { contains: q } }, { entityId: q }],
        }
      : {}),
  };
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.auditLog.count({ where }),
  ]);
  const actors = await db.user.findMany({
    where: { id: { in: [...new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x))] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(actors.map((a) => [a.id, a.name]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: number) =>
    `?${new URLSearchParams({ ...(group ? { g: group } : {}), ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Auditoria</h1>
        <p className="text-muted-foreground">
          Logins, acessos ao prontuário e alterações importantes, com data, hora e IP. Nenhum
          conteúdo clínico é registrado aqui.
        </p>
      </div>
      <form className="flex flex-wrap gap-2" role="search">
        <NativeSelect name="g" defaultValue={group} aria-label="Categoria" className="w-48">
          <option value="">Todas as categorias</option>
          <option value="login">Acesso e conta</option>
          <option value="prontuario">Prontuário</option>
          <option value="financeiro">Financeiro</option>
          <option value="lgpd">LGPD e documentos</option>
          <option value="config">Configurações</option>
        </NativeSelect>
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Ação, IP ou ID"
          className="w-56"
          aria-label="Buscar"
        />
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Quem</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Alvo</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum registro.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{fmtDateTime(l.createdAt)}</td>
                <td className="px-4 py-2.5">
                  {l.actorId ? (
                    (nameById.get(l.actorId) ?? l.actorId.slice(-6))
                  ) : (
                    <span className="text-muted-foreground">anônimo</span>
                  )}
                  {l.actorRole && (
                    <span className="ml-1 text-xs text-muted-foreground">({l.actorRole})</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {l.entity ?? ''}
                  {l.entityId ? ` · ${l.entityId.slice(-6)}` : ''}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link className="text-primary hover:underline" href={link(page - 1)}>
              ← Anterior
            </Link>
          )}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages && (
            <Link className="text-primary hover:underline" href={link(page + 1)}>
              Próxima →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
