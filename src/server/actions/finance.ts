'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { optionalTrimmed, ymdSchema } from '@/lib/validators';
import { ok, run, UserError, type ActionResult } from '../action-result';
import { requirePermissionOrThrow } from '../session';

const method = z.enum(['PIX', 'DINHEIRO', 'CARTAO', 'TRANSFERENCIA']);

/** Marca pagamento como pago/pendente/isento (controle manual). */
export async function setPaymentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('finance.manage');
    const d = z
      .object({
        id: z.string(),
        status: z.enum(['PENDENTE', 'PAGO', 'ISENTO']),
        method: method.optional().or(z.literal('')),
        paidYmd: ymdSchema.optional().or(z.literal('')),
        amountCents: z.number().int().min(0).optional(),
        notes: optionalTrimmed(300),
      })
      .parse(input);

    const payment = await db.payment.findUnique({ where: { id: d.id } });
    if (!payment) throw new UserError('Pagamento não encontrado.');
    if (d.status === 'PAGO' && !d.method)
      throw new UserError('Informe a forma de pagamento.', { method: ['Obrigatório.'] });

    await db.payment.update({
      where: { id: d.id },
      data: {
        status: d.status,
        method: d.status === 'PAGO' ? (d.method as z.infer<typeof method>) : null,
        paidAt:
          d.status === 'PAGO'
            ? new Date(`${d.paidYmd || new Date().toISOString().slice(0, 10)}T12:00:00Z`)
            : null,
        amountCents: d.amountCents ?? payment.amountCents,
        notes: d.notes ?? payment.notes,
      },
    });
    await audit({
      action: 'PAYMENT_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Payment',
      entityId: d.id,
      metadata: { status: d.status },
    });
    revalidatePath('/admin', 'layout');
    revalidatePath('/paciente', 'layout');
    return ok('Pagamento atualizado.');
  });
}

/** Cobrança avulsa (sem sessão vinculada). */
export async function createManualPaymentAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('finance.manage');
    const d = z
      .object({
        patientId: z.string(),
        amountCents: z.number().int().min(1, 'Informe um valor.'),
        status: z.enum(['PENDENTE', 'PAGO']),
        method: method.optional().or(z.literal('')),
        notes: optionalTrimmed(300),
      })
      .parse(input);
    if (d.status === 'PAGO' && !d.method) throw new UserError('Informe a forma de pagamento.');
    const p = await db.payment.create({
      data: {
        patientId: d.patientId,
        amountCents: d.amountCents,
        status: d.status,
        method: d.status === 'PAGO' ? (d.method as z.infer<typeof method>) : null,
        paidAt: d.status === 'PAGO' ? new Date() : null,
        notes: d.notes ?? 'Cobrança avulsa',
      },
    });
    await audit({
      action: 'PAYMENT_UPDATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'Payment',
      entityId: p.id,
      metadata: { manual: true },
    });
    revalidatePath('/admin', 'layout');
    return ok('Cobrança registrada.');
  });
}

/** Venda de um pacote de sessões (gera a cobrança do pacote). */
export async function createPackageAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('finance.manage');
    const d = z
      .object({
        patientId: z.string(),
        name: z.string().trim().min(2, 'Informe o nome.').max(80),
        totalSessions: z.number().int().min(1).max(100),
        priceCents: z.number().int().min(0),
        validDays: z.number().int().min(0).max(1000).optional(),
        paid: z.boolean(),
        method: method.optional().or(z.literal('')),
      })
      .parse(input);
    if (d.paid && !d.method) throw new UserError('Informe a forma de pagamento.');

    await db.$transaction(async (tx) => {
      const pkg = await tx.sessionPackage.create({
        data: {
          patientId: d.patientId,
          name: d.name,
          totalSessions: d.totalSessions,
          priceCents: d.priceCents,
          expiresAt: d.validDays ? new Date(Date.now() + d.validDays * 86_400_000) : null,
        },
      });
      await tx.payment.create({
        data: {
          patientId: d.patientId,
          packageId: pkg.id,
          amountCents: d.priceCents,
          status: d.priceCents === 0 ? 'ISENTO' : d.paid ? 'PAGO' : 'PENDENTE',
          method: d.paid ? (d.method as z.infer<typeof method>) : null,
          paidAt: d.paid ? new Date() : null,
          notes: `Pacote: ${d.name}`,
        },
      });
    });
    await audit({
      action: 'PACKAGE_CREATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'PatientProfile',
      entityId: d.patientId,
    });
    revalidatePath('/admin', 'layout');
    return ok('Pacote criado.');
  });
}

export async function cancelPackageAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermissionOrThrow('finance.manage');
    const { id } = z.object({ id: z.string() }).parse(input);
    const pkg = await db.sessionPackage.findUnique({ where: { id }, include: { payments: true } });
    if (!pkg) throw new UserError('Pacote não encontrado.');
    await db.$transaction([
      db.sessionPackage.update({ where: { id }, data: { cancelledAt: new Date() } }),
      // Cobrança ainda pendente deixa de ser devida; pagamentos já feitos permanecem (reembolso é manual)
      db.payment.updateMany({
        where: { packageId: id, status: 'PENDENTE' },
        data: { status: 'ISENTO', notes: 'auto: pacote cancelado' },
      }),
    ]);
    await audit({
      action: 'PACKAGE_CREATE',
      actorId: actor.id,
      actorRole: actor.role,
      entity: 'SessionPackage',
      entityId: id,
      metadata: { cancelled: true },
    });
    revalidatePath('/admin', 'layout');
    return ok('Pacote cancelado.');
  });
}
