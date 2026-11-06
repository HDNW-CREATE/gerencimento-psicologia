import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { can } from '@/lib/permissions';
import { rateLimit } from '@/lib/ratelimit';
import { getCurrentUser } from '@/server/session';

export const dynamic = 'force-dynamic';

/**
 * Exportação dos dados do titular (LGPD art. 18) em JSON – baixada pela psicóloga e enviada ao paciente.
 * Inclui dados cadastrais, sessões, financeiro, documentos (metadados) e aceites.
 * NÃO inclui o conteúdo do prontuário: ele é fornecido mediante solicitação direta à psicóloga,
 * conforme as normas do Conselho Federal de Psicologia.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, 'lgpd.manage'))
    return new NextResponse('Não encontrado', { status: 404 });
  const rl = await rateLimit(`export-lgpd:${user.id}`, 10, 60);
  if (!rl.allowed) return new NextResponse('Muitas requisições', { status: 429 });

  const { id } = await ctx.params;
  const req = await db.dataRequest.findUnique({ where: { id } });
  if (!req || req.type !== 'EXPORTACAO') return new NextResponse('Não encontrado', { status: 404 });

  const u = await db.user.findUnique({
    where: { id: req.userId },
    select: {
      email: true,
      name: true,
      createdAt: true,
      emailVerifiedAt: true,
      consents: {
        select: {
          acceptedAt: true,
          legalDocument: { select: { type: true, version: true, title: true } },
        },
      },
      patientProfile: {
        include: {
          appointments: {
            where: { deletedAt: null },
            select: {
              startsAt: true,
              endsAt: true,
              modality: true,
              status: true,
              priceCents: true,
              serviceType: { select: { name: true } },
            },
          },
          payments: {
            select: {
              amountCents: true,
              status: true,
              method: true,
              paidAt: true,
              receiptNumber: true,
            },
          },
          documents: {
            where: { deletedAt: null },
            select: { title: true, kind: true, createdAt: true, sharedWithPatient: true },
          },
          packages: {
            select: { name: true, totalSessions: true, priceCents: true, purchasedAt: true },
          },
        },
      },
    },
  });
  if (!u) return new NextResponse('Não encontrado', { status: 404 });

  const payload = {
    geradoEm: new Date().toISOString(),
    observacao:
      'O conteúdo do prontuário não está incluído e é fornecido mediante solicitação direta à psicóloga, conforme normas do CFP.',
    conta: {
      nome: u.name,
      email: u.email,
      criadaEm: u.createdAt,
      emailConfirmadoEm: u.emailVerifiedAt,
    },
    aceites: u.consents.map((c) => ({
      documento: c.legalDocument.title,
      tipo: c.legalDocument.type,
      versao: c.legalDocument.version,
      aceitoEm: c.acceptedAt,
    })),
    ficha: u.patientProfile
      ? {
          ...u.patientProfile,
          appointments: undefined,
          payments: undefined,
          documents: undefined,
          packages: undefined,
          adminNotes: undefined,
        }
      : null,
    sessoes: u.patientProfile?.appointments ?? [],
    pagamentos: u.patientProfile?.payments ?? [],
    pacotes: u.patientProfile?.packages ?? [],
    documentos: u.patientProfile?.documents ?? [],
  };

  await audit({
    action: 'DATA_EXPORT',
    actorId: user.id,
    actorRole: user.role,
    entity: 'DataRequest',
    entityId: id,
  });
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-titular-${id.slice(-6)}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
