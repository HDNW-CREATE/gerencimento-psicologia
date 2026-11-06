import 'server-only';
import type { Prisma, PaymentStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { endOfLocalDayUtc, startOfLocalDayUtc, utcToLocalYmd } from '@/lib/domain/time';

export interface FinanceFilter {
  fromYmd: string;
  toYmd: string;
  status?: PaymentStatus;
  q?: string;
}

/** Período padrão: mês corrente. */
export function defaultPeriod(now = new Date()) {
  const ymd = utcToLocalYmd(now);
  const [y, m] = ymd.split('-');
  const last = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  return { fromYmd: `${y}-${m}-01`, toYmd: `${y}-${m}-${String(last).padStart(2, '0')}` };
}

/**
 * Data de referência de um lançamento: a data da sessão (quando há sessão) ou a de criação (avulso/pacote).
 * O filtro por período usa essa data, e os "recebidos" usam a data do pagamento.
 */
export function financeWhere(f: FinanceFilter): Prisma.PaymentWhereInput {
  const from = startOfLocalDayUtc(f.fromYmd);
  const to = endOfLocalDayUtc(f.toYmd);
  return {
    AND: [
      {
        OR: [
          { appointment: { startsAt: { gte: from, lt: to }, deletedAt: null } },
          { appointmentId: null, createdAt: { gte: from, lt: to } },
        ],
      },
      ...(f.status ? [{ status: f.status }] : []),
      ...(f.q ? [{ patient: { fullName: { contains: f.q, mode: 'insensitive' as const } } }] : []),
    ],
  };
}

export async function listFinance(f: FinanceFilter, take = 500) {
  return db.payment.findMany({
    where: financeWhere(f),
    include: {
      patient: { select: { id: true, fullName: true, socialName: true, cpf: true } },
      appointment: { include: { serviceType: true } },
      package: true,
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function financeSummary(f: FinanceFilter) {
  const from = startOfLocalDayUtc(f.fromYmd);
  const to = endOfLocalDayUtc(f.toYmd);
  const [received, pending, waived] = await Promise.all([
    db.payment.aggregate({
      where: { status: 'PAGO', paidAt: { gte: from, lt: to } },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { ...financeWhere({ ...f, status: 'PENDENTE' }), amountCents: { gt: 0 } },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.payment.count({ where: financeWhere({ ...f, status: 'ISENTO' }) }),
  ]);
  return {
    receivedCents: received._sum.amountCents ?? 0,
    receivedCount: received._count,
    pendingCents: pending._sum.amountCents ?? 0,
    pendingCount: pending._count,
    waivedCount: waived,
  };
}
