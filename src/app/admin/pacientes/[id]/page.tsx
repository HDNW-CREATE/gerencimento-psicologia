import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, MessageCircle, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentBadge, StatusBadge } from '@/components/status-badge';
import { PaymentActions } from '@/components/payment-actions';
import { db } from '@/lib/db';
import { can } from '@/lib/permissions';
import {
  fmtDate,
  fmtDateOnly,
  fmtDateTime,
  formatBRL,
  maskCpf,
  maskPhone,
  modalityLabels,
  paymentMethodLabels,
  whatsappLink,
} from '@/lib/format';
import { isMinor } from '@/lib/validators';
import { requirePermission } from '@/server/session';
import { PatientForm, type PatientFormValues } from '../patient-form';
import { PatientTools } from './patient-tools';
import { DocumentsPanel } from './documents-panel';
import { PackagesPanel } from './packages-panel';

export const metadata: Metadata = { title: 'Ficha do paciente' };

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('patients.read');
  const { id } = await params;
  const p = await db.patientProfile.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: { select: { emailVerifiedAt: true, lastLoginAt: true } },
      appointments: {
        where: { deletedAt: null },
        include: { serviceType: true, payment: true },
        orderBy: { startsAt: 'desc' },
        take: 60,
      },
      payments: { where: { appointmentId: null }, orderBy: { createdAt: 'desc' } },
      packages: {
        orderBy: { purchasedAt: 'desc' },
        include: {
          payments: true,
          _count: {
            select: {
              appointments: {
                where: {
                  deletedAt: null,
                  status: { notIn: ['CANCELADA_PACIENTE', 'CANCELADA_PSICOLOGA', 'RECUSADA'] },
                },
              },
            },
          },
        },
      },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!p) notFound();

  const canClinical = can(user.role, 'clinical.read');
  const canFinance = can(user.role, 'finance.manage');
  const canDocs = can(user.role, 'documents.manage');
  const birthYmd = p.birthDate?.toISOString().slice(0, 10);
  const minor = birthYmd ? isMinor(birthYmd) : false;
  const pendingTotal =
    p.appointments.reduce(
      (s, a) => s + (a.payment?.status === 'PENDENTE' ? a.payment.amountCents : 0),
      0,
    ) + p.payments.filter((x) => x.status === 'PENDENTE').reduce((s, x) => s + x.amountCents, 0);

  const initial: PatientFormValues = {
    fullName: p.fullName,
    socialName: p.socialName ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    birthDate: birthYmd ?? '',
    cpf: p.cpf ?? '',
    status: p.status,
    guardianName: p.guardianName ?? '',
    guardianCpf: p.guardianCpf ?? '',
    guardianPhone: p.guardianPhone ?? '',
    guardianEmail: p.guardianEmail ?? '',
    guardianRelation: p.guardianRelation ?? '',
    emergencyName: p.emergencyName ?? '',
    emergencyPhone: p.emergencyPhone ?? '',
    emergencyRelation: p.emergencyRelation ?? '',
    partnerName: p.partnerName ?? '',
    partnerPhone: p.partnerPhone ?? '',
    partnerEmail: p.partnerEmail ?? '',
    adminNotes: p.adminNotes ?? '',
    tags: p.tags.join(', '),
    customPrice:
      p.customPriceCents != null ? (p.customPriceCents / 100).toFixed(2).replace('.', ',') : '',
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/pacientes" className="text-sm text-primary hover:underline">
          ← Pacientes
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl">{p.socialName ?? p.fullName}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {p.socialName && <span>{p.fullName}</span>}
              {p.cpf && <span>CPF {maskCpf(p.cpf)}</span>}
              {p.phone && <span>{maskPhone(p.phone)}</span>}
              {p.email && <span>{p.email}</span>}
              {birthYmd && <span>Nasc. {fmtDateOnly(p.birthDate!)}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {minor && <Badge variant="warning">Menor de idade</Badge>}
              {!p.userId && <Badge variant="muted">Sem conta no sistema</Badge>}
              {p.user && !p.user.emailVerifiedAt && (
                <Badge variant="warning">E-mail não confirmado</Badge>
              )}
              {p.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.phone && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={whatsappLink(p.phone, `Olá, ${p.socialName ?? p.fullName.split(' ')[0]}! `)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            )}
            {canClinical && (
              <Button asChild size="sm">
                <Link href={`/admin/pacientes/${p.id}/prontuario`}>
                  <FileText /> Prontuário
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <PatientTools patientId={p.id} status={p.status} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de sessões</CardTitle>
              <CardDescription>{p.appointments.length} sessão(ões) (últimas 60).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:p-0">
              <table className="w-full min-w-[520px] text-sm">
                <tbody className="divide-y">
                  {p.appointments.length === 0 && (
                    <tr>
                      <td className="px-6 py-6 text-center text-muted-foreground">
                        Nenhuma sessão.
                      </td>
                    </tr>
                  )}
                  {p.appointments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-6 py-2.5">
                        <span className="font-medium">{fmtDateTime(a.startsAt)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {a.serviceType.name} · {modalityLabels[a.modality]}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-2 py-2.5">
                        {a.payment ? (
                          <PaymentBadge status={a.payment.status} />
                        ) : a.packageId ? (
                          <Badge variant="secondary">Pacote</Badge>
                        ) : null}
                      </td>
                      <td className="px-6 py-2.5 text-right">
                        {a.payment?.status === 'PAGO' && (
                          <Button asChild size="sm" variant="ghost" aria-label="Baixar recibo">
                            <a href={`/api/recibos/${a.payment.id}`}>
                              <Download /> Recibo
                            </a>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {canFinance && (
            <Card>
              <CardHeader>
                <CardTitle>Financeiro</CardTitle>
                <CardDescription>
                  Pendente: <strong>{formatBRL(pendingTotal)}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.appointments
                  .filter((a) => a.payment && a.payment.status !== 'ISENTO')
                  .slice(0, 20)
                  .map((a) => (
                    <div
                      key={a.payment!.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {fmtDate(a.startsAt)} · {formatBRL(a.payment!.amountCents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.payment!.method
                            ? paymentMethodLabels[a.payment!.method]
                            : 'Sem forma registrada'}
                          {a.payment!.paidAt ? ` · pago em ${fmtDate(a.payment!.paidAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <PaymentBadge status={a.payment!.status} />
                        <PaymentActions payment={a.payment!} />
                      </div>
                    </div>
                  ))}
                {p.payments.map((x) => (
                  <div
                    key={x.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {x.notes ?? 'Cobrança avulsa'} · {formatBRL(x.amountCents)}
                      </p>
                      <p className="text-xs text-muted-foreground">{fmtDate(x.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PaymentBadge status={x.status} />
                      <PaymentActions payment={x} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {canFinance && (
            <PackagesPanel
              patientId={p.id}
              packages={p.packages.map((k) => ({
                id: k.id,
                name: k.name,
                total: k.totalSessions,
                used: k._count.appointments,
                priceCents: k.priceCents,
                cancelled: !!k.cancelledAt,
                expiresAt: k.expiresAt?.toISOString() ?? null,
                paymentStatus: k.payments[0]?.status ?? 'PENDENTE',
              }))}
            />
          )}
          {canDocs && (
            <DocumentsPanel
              patientId={p.id}
              docs={p.documents.map((d) => ({
                id: d.id,
                title: d.title,
                kind: d.kind,
                shared: d.sharedWithPatient,
                createdAt: d.createdAt.toISOString(),
                sizeBytes: d.sizeBytes,
              }))}
            />
          )}
          {p.user && (
            <Card>
              <CardHeader>
                <CardTitle>Conta de acesso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>E-mail {p.user.emailVerifiedAt ? 'confirmado' : 'NÃO confirmado'}</p>
                <p className="text-muted-foreground">
                  Último acesso: {p.user.lastLoginAt ? fmtDateTime(p.user.lastLoginAt) : 'nunca'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <section aria-labelledby="editar" className="space-y-3">
        <h2 id="editar" className="text-2xl">
          Editar dados
        </h2>
        <PatientForm patientId={p.id} initial={initial} />
      </section>
    </div>
  );
}
