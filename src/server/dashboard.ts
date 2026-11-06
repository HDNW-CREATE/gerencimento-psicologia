import 'server-only';
import { db } from '@/lib/db';
import {
  addDaysYmd,
  endOfLocalDayUtc,
  localToUtc,
  startOfLocalDayUtc,
  utcToLocalYmd,
  weekdayOfYmd,
} from '@/lib/domain/time';

/** Primeiro dia do mês (YYYY-MM-01) deslocado em `offset` meses. */
function monthStart(ymd: string, offset: number): string {
  const [y, m] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + offset, 1));
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export async function loadDashboard(now = new Date()) {
  const today = utcToLocalYmd(now);
  const dayStart = startOfLocalDayUtc(today);
  const dayEnd = endOfLocalDayUtc(today);
  // Semana: segunda a domingo
  const wd = weekdayOfYmd(today);
  const weekStartYmd = addDaysYmd(today, -((wd + 6) % 7));
  const weekStart = startOfLocalDayUtc(weekStartYmd);
  const weekEnd = endOfLocalDayUtc(addDaysYmd(weekStartYmd, 6));

  const thisMonth = monthStart(today, 0);
  const mStart = localToUtc(thisMonth, 0);
  const mEnd = localToUtc(monthStart(today, 1), 0);

  const live = { deletedAt: null as null };
  const [
    todayList,
    weekCount,
    realizadas,
    faltas,
    canceladas,
    novos,
    received,
    toReceive,
    overdue,
    lgpd,
    unverified,
    awaiting,
  ] = await Promise.all([
    db.appointment.findMany({
      where: {
        ...live,
        startsAt: { gte: dayStart, lt: dayEnd },
        status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA', 'REALIZADA', 'FALTA'] },
      },
      include: {
        patient: { select: { id: true, fullName: true, socialName: true } },
        serviceType: { select: { name: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    db.appointment.count({
      where: {
        ...live,
        startsAt: { gte: weekStart, lt: weekEnd },
        status: { in: ['PENDENTE', 'AGENDADA', 'CONFIRMADA', 'REALIZADA'] },
      },
    }),
    db.appointment.count({
      where: { ...live, startsAt: { gte: mStart, lt: mEnd }, status: 'REALIZADA' },
    }),
    db.appointment.count({
      where: { ...live, startsAt: { gte: mStart, lt: mEnd }, status: 'FALTA' },
    }),
    db.appointment.count({
      where: {
        ...live,
        startsAt: { gte: mStart, lt: mEnd },
        status: { in: ['CANCELADA_PACIENTE', 'CANCELADA_PSICOLOGA'] },
      },
    }),
    db.patientProfile.count({ where: { deletedAt: null, createdAt: { gte: mStart, lt: mEnd } } }),
    db.payment.aggregate({
      where: { status: 'PAGO', paidAt: { gte: mStart, lt: mEnd } },
      _sum: { amountCents: true },
    }),
    db.payment.aggregate({
      where: {
        status: 'PENDENTE',
        amountCents: { gt: 0 },
        OR: [
          { appointment: { startsAt: { gte: mStart, lt: mEnd }, deletedAt: null } },
          { appointmentId: null, createdAt: { gte: mStart, lt: mEnd } },
        ],
      },
      _sum: { amountCents: true },
    }),
    // Atrasados: pendentes de sessões já ocorridas há mais de 7 dias
    db.payment.findMany({
      where: {
        status: 'PENDENTE',
        amountCents: { gt: 0 },
        appointment: {
          startsAt: { lt: new Date(now.getTime() - 7 * 86_400_000) },
          status: { in: ['REALIZADA', 'FALTA'] },
          deletedAt: null,
        },
      },
      include: {
        patient: { select: { id: true, fullName: true, socialName: true } },
        appointment: { select: { startsAt: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 8,
    }),
    db.dataRequest.count({ where: { status: { in: ['ABERTA', 'EM_ANALISE'] } } }),
    db.user.count({ where: { role: 'PACIENTE', deletedAt: null, emailVerifiedAt: null } }),
    db.appointment.findMany({
      where: { ...live, status: 'PENDENTE', startsAt: { gt: now } },
      include: { patient: { select: { fullName: true, socialName: true } } },
      orderBy: { startsAt: 'asc' },
      take: 8,
    }),
  ]);

  // Evolução dos últimos 6 meses (agrupado no app: poucos registros por consultório)
  const series: { label: string; realizadas: number; faltas: number; faturamento: number }[] = [];
  const from = localToUtc(monthStart(today, -5), 0);
  const [appts, pays] = await Promise.all([
    db.appointment.findMany({
      where: { ...live, startsAt: { gte: from, lt: mEnd }, status: { in: ['REALIZADA', 'FALTA'] } },
      select: { startsAt: true, status: true },
    }),
    db.payment.findMany({
      where: { status: 'PAGO', paidAt: { gte: from, lt: mEnd } },
      select: { paidAt: true, amountCents: true },
    }),
  ]);
  for (let i = -5; i <= 0; i++) {
    const start = monthStart(today, i);
    const s = localToUtc(start, 0);
    const e = localToUtc(monthStart(today, i + 1), 0);
    series.push({
      label: `${MONTHS[Number(start.split('-')[1]) - 1]}/${start.slice(2, 4)}`,
      realizadas: appts.filter((a) => a.status === 'REALIZADA' && a.startsAt >= s && a.startsAt < e)
        .length,
      faltas: appts.filter((a) => a.status === 'FALTA' && a.startsAt >= s && a.startsAt < e).length,
      faturamento:
        pays
          .filter((p) => p.paidAt! >= s && p.paidAt! < e)
          .reduce((sum, p) => sum + p.amountCents, 0) / 100,
    });
  }

  return {
    todayList,
    weekCount,
    month: {
      realizadas,
      faltas,
      canceladas,
      novos,
      receivedCents: received._sum.amountCents ?? 0,
      toReceiveCents: toReceive._sum.amountCents ?? 0,
    },
    overdue,
    lgpd,
    unverified,
    awaiting,
    series,
  };
}
