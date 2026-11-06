import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { db } from '@/lib/db';
import { fmtDate, maskPhone, patientStatusLabels } from '@/lib/format';
import { requirePermission } from '@/server/session';

export const metadata: Metadata = { title: 'Pacientes' };

const PAGE_SIZE = 25;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }>;
}) {
  await requirePermission('patients.read');
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? '';
  const status = ['ATIVO', 'INATIVO', 'ALTA'].includes(sp.status ?? '')
    ? (sp.status as 'ATIVO' | 'INATIVO' | 'ALTA')
    : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.PatientProfileWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { socialName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q.replace(/\D/g, '') || '__none__' } },
            { cpf: { contains: q.replace(/\D/g, '') || '__none__' } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.PatientProfileOrderByWithRelationInput =
    sp.sort === 'recent'
      ? { createdAt: 'desc' }
      : sp.sort === 'status'
        ? { status: 'asc' }
        : { fullName: 'asc' };

  const [patients, total] = await Promise.all([
    db.patientProfile.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { emailVerifiedAt: true } },
        appointments: {
          where: {
            deletedAt: null,
            status: { in: ['AGENDADA', 'CONFIRMADA', 'PENDENTE'] },
            startsAt: { gt: new Date() },
          },
          orderBy: { startsAt: 'asc' },
          take: 1,
          select: { startsAt: true },
        },
      },
    }),
    db.patientProfile.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) =>
    `?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(sp.sort ? { sort: sp.sort } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Pacientes</h1>
          <p className="text-muted-foreground">{total} paciente(s) encontrado(s).</p>
        </div>
        <Button asChild>
          <Link href="/admin/pacientes/novo">
            <Plus /> Novo paciente
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" role="search">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, e-mail, telefone ou CPF"
            className="pl-9"
            aria-label="Buscar paciente"
          />
        </div>
        <NativeSelect
          name="status"
          defaultValue={status ?? ''}
          aria-label="Filtrar por situação"
          className="w-40"
        >
          <option value="">Todos</option>
          <option value="ATIVO">Ativos</option>
          <option value="INATIVO">Inativos</option>
          <option value="ALTA">Em alta</option>
        </NativeSelect>
        <NativeSelect
          name="sort"
          defaultValue={sp.sort ?? ''}
          aria-label="Ordenar"
          className="w-44"
        >
          <option value="">Nome (A–Z)</option>
          <option value="recent">Mais recentes</option>
          <option value="status">Situação</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Paciente</th>
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Próxima sessão</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {patients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum paciente encontrado.
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/pacientes/${p.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {p.socialName ?? p.fullName}
                  </Link>
                  {p.socialName && (
                    <span className="block text-xs text-muted-foreground">{p.fullName}</span>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!p.userId && <Badge variant="muted">sem conta</Badge>}
                    {p.user && !p.user.emailVerifiedAt && (
                      <Badge variant="warning">e-mail não confirmado</Badge>
                    )}
                    {p.tags.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.email && <span className="block">{p.email}</span>}
                  {p.phone && <span className="block">{maskPhone(p.phone)}</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      p.status === 'ATIVO' ? 'success' : p.status === 'ALTA' ? 'secondary' : 'muted'
                    }
                  >
                    {patientStatusLabels[p.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {p.appointments[0] ? (
                    fmtDate(p.appointments[0].startsAt, "dd/MM 'às' HH:mm")
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link className="text-primary hover:underline" href={qs(page - 1)}>
              ← Anterior
            </Link>
          )}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages && (
            <Link className="text-primary hover:underline" href={qs(page + 1)}>
              Próxima →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
