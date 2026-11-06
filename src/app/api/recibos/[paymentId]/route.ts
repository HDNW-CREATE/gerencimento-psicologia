import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { valorPorExtenso } from '@/lib/extenso';
import {
  fmtDate,
  fmtDateOnly,
  fmtTime,
  formatBRL,
  maskCpf,
  paymentMethodLabels,
} from '@/lib/format';
import { can } from '@/lib/permissions';
import { PdfBuilder } from '@/lib/pdf';
import { rateLimit } from '@/lib/ratelimit';
import { getClinic } from '@/lib/settings';
import { getObject, sniffMime } from '@/lib/storage';
import { getCurrentUser } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * Recibo em PDF (útil para reembolso de convênio e Imposto de Renda).
 * Acesso: equipe com `finance.manage` OU o próprio paciente dono do pagamento.
 * Só emite recibo de pagamentos com status PAGO.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ paymentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Não autorizado', { status: 401 });
  const rl = await rateLimit(`receipt:${user.id}`, 30, 60);
  if (!rl.allowed) return new NextResponse('Muitas requisições', { status: 429 });

  const { paymentId } = await ctx.params;
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { patient: true, appointment: { include: { serviceType: true } }, package: true },
  });

  const isStaff = can(user.role, 'finance.manage');
  const isOwner = user.role === 'PACIENTE' && user.patientProfile?.id === payment?.patientId;
  // 404 idêntico para "não existe" e "não é seu"
  if (!payment || (!isStaff && !isOwner))
    return new NextResponse('Não encontrado', { status: 404 });
  if (payment.status !== 'PAGO' || !payment.paidAt) {
    return new NextResponse('O recibo só pode ser emitido após a confirmação do pagamento.', {
      status: 409,
    });
  }

  const clinic = await getClinic();
  const p = payment.patient;
  const pdf = await PdfBuilder.create(`${clinic.professionalName} · ${clinic.crp}`);

  pdf.text(clinic.clinicName, { size: 20, bold: true, color: [0.25, 0.42, 0.34], align: 'center' });
  pdf.text(`${clinic.professionalName} · ${clinic.crp}`, { size: 11, align: 'center' });
  if (clinic.document) pdf.text(`CPF/CNPJ: ${clinic.document}`, { size: 10, align: 'center' });
  const addr = [clinic.addressLine, [clinic.city, clinic.state].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(' · ');
  if (addr) pdf.text(addr, { size: 10, align: 'center', gap: 6 });
  pdf.rule();
  pdf.text(`RECIBO Nº ${String(payment.receiptNumber).padStart(6, '0')}`, {
    size: 16,
    bold: true,
    align: 'center',
    gap: 10,
  });
  pdf.text(`Valor: ${formatBRL(payment.amountCents)}`, {
    size: 14,
    bold: true,
    align: 'center',
    gap: 14,
  });

  const description = payment.appointment
    ? `${payment.appointment.serviceType.name} realizado(a) em ${fmtDate(payment.appointment.startsAt)} às ${fmtTime(payment.appointment.startsAt)}`
    : payment.package
      ? `${payment.package.name} (${payment.package.totalSessions} sessões de psicoterapia)`
      : (payment.notes ?? 'Serviços de psicoterapia');

  const payerCpf = p.cpf ? `, CPF ${maskCpf(p.cpf)}` : '';
  pdf.text(
    `Recebi de ${p.fullName}${payerCpf}, a importância de ${formatBRL(payment.amountCents)} (${valorPorExtenso(payment.amountCents)}), referente a ${description}.`,
    { size: 12, gap: 10 },
  );
  pdf.kv(
    'Forma de pagamento',
    payment.method ? paymentMethodLabels[payment.method]! : 'Não informada',
  );
  pdf.kv('Data do pagamento', fmtDateOnly(payment.paidAt));
  pdf.kv('Emitido em', fmtDate(new Date(), "dd/MM/yyyy 'às' HH:mm"));
  pdf.space(30);

  // Assinatura (imagem opcional)
  if (clinic.signatureKey) {
    const buf = await getObject(clinic.signatureKey);
    const mime = buf ? sniffMime(buf) : null;
    if (buf && (mime === 'image/png' || mime === 'image/jpeg'))
      await pdf.image(new Uint8Array(buf), mime, 180, 70, 'center');
  }
  pdf.rule();
  pdf.text(clinic.professionalName, { size: 11, bold: true, align: 'center' });
  pdf.text(clinic.crp, { size: 10, align: 'center', gap: 14 });
  if (clinic.receiptFooter)
    pdf.text(clinic.receiptFooter, { size: 9, color: [0.4, 0.4, 0.38], align: 'center' });

  const bytes = await pdf.save();
  await audit({
    action: 'RECEIPT_ISSUED',
    actorId: user.id,
    actorRole: user.role,
    entity: 'Payment',
    entityId: payment.id,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${String(payment.receiptNumber).padStart(6, '0')}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
