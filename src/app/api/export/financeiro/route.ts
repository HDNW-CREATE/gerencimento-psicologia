import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { isValidYmd } from '@/lib/domain/time';
import { fmtDate, paymentMethodLabels, paymentStatusLabels } from '@/lib/format';
import { can } from '@/lib/permissions';
import { rateLimit } from '@/lib/ratelimit';
import { defaultPeriod, listFinance } from '@/server/finance-queries';
import { getCurrentUser } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Protege contra "injeção de fórmula" em planilhas (=, +, -, @ no início da célula). */
function cell(v: string | number | null | undefined): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV com separador ";" e BOM UTF-8: abre direto no Excel em português. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, 'finance.manage'))
    return new NextResponse('Não encontrado', { status: 404 });
  const rl = await rateLimit(`export-fin:${user.id}`, 20, 60);
  if (!rl.allowed) return new NextResponse('Muitas requisições', { status: 429 });

  const url = new URL(req.url);
  const def = defaultPeriod();
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const st = url.searchParams.get('status') ?? '';
  const filter = {
    fromYmd: isValidYmd(from) ? from : def.fromYmd,
    toYmd: isValidYmd(to) ? to : def.toYmd,
    status: (['PENDENTE', 'PAGO', 'ISENTO'].includes(st) ? st : undefined) as
      'PENDENTE' | 'PAGO' | 'ISENTO' | undefined,
    q: url.searchParams.get('q')?.slice(0, 80) || undefined,
  };

  const rows = await listFinance(filter, 5000);
  const header = [
    'Data de referência',
    'Paciente',
    'Descrição',
    'Valor (R$)',
    'Situação',
    'Forma de pagamento',
    'Data do pagamento',
    'Recibo nº',
  ];
  const lines = rows.map((p) =>
    [
      p.appointment ? fmtDate(p.appointment.startsAt) : fmtDate(p.createdAt),
      p.patient.fullName,
      p.appointment ? p.appointment.serviceType.name : (p.package?.name ?? p.notes ?? 'Avulso'),
      (p.amountCents / 100).toFixed(2).replace('.', ','),
      paymentStatusLabels[p.status],
      p.method ? paymentMethodLabels[p.method] : '',
      p.paidAt ? fmtDate(p.paidAt) : '',
      p.status === 'PAGO' ? String(p.receiptNumber).padStart(6, '0') : '',
    ]
      .map(cell)
      .join(';'),
  );
  const csv = '﻿' + [header.map(cell).join(';'), ...lines].join('\r\n');

  await audit({
    action: 'REPORT_EXPORT',
    actorId: user.id,
    actorRole: user.role,
    metadata: { rows: rows.length, from: filter.fromYmd, to: filter.toYmd },
  });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="financeiro-${filter.fromYmd}_a_${filter.toYmd}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
