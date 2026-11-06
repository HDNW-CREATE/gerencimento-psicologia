import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { fmtDate, fmtDateOnly, fmtDateTime, maskCpf } from '@/lib/format';
import { htmlToText, PdfBuilder } from '@/lib/pdf';
import { can } from '@/lib/permissions';
import { rateLimit } from '@/lib/ratelimit';
import { getAnamnesisConfig, getClinic } from '@/lib/settings';
import { getAnamnesis, listRecords } from '@/server/clinical';
import { getCurrentUser } from '@/server/session';

export const dynamic = 'force-dynamic';

/** Exporta o prontuário completo em PDF. Somente quem tem `clinical.read` (ADMIN). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, 'clinical.read'))
    return new NextResponse('Não encontrado', { status: 404 });
  const rl = await rateLimit(`export-clinical:${user.id}`, 10, 60);
  if (!rl.allowed) return new NextResponse('Muitas requisições', { status: 429 });

  const { id } = await ctx.params;
  const patient = await db.patientProfile.findFirst({ where: { id, deletedAt: null } });
  if (!patient) return new NextResponse('Não encontrado', { status: 404 });

  const [clinic, records, anamnesis, config] = await Promise.all([
    getClinic(),
    listRecords(id),
    getAnamnesis(id),
    getAnamnesisConfig(),
  ]);
  const pdf = await PdfBuilder.create('Documento sigiloso – prontuário psicológico');

  pdf.text('PRONTUÁRIO PSICOLÓGICO', { size: 18, bold: true, color: [0.25, 0.42, 0.34] });
  pdf.text(
    'Documento sigiloso. Uso exclusivo do(a) psicólogo(a) responsável (Resolução CFP nº 001/2009 e normas correlatas).',
    { size: 9, color: [0.4, 0.4, 0.38], gap: 8 },
  );
  pdf.rule();
  pdf.kv('Paciente', patient.fullName);
  if (patient.socialName) pdf.kv('Nome social', patient.socialName);
  if (patient.birthDate) pdf.kv('Nascimento', fmtDateOnly(patient.birthDate));
  if (patient.cpf) pdf.kv('CPF', maskCpf(patient.cpf));
  pdf.kv('Profissional', `${clinic.professionalName} – ${clinic.crp}`);
  pdf.kv('Exportado em', fmtDate(new Date(), "dd/MM/yyyy 'às' HH:mm"));
  pdf.space(6);

  if (anamnesis) {
    pdf.heading('Anamnese');
    for (const f of config.fields) {
      const v = anamnesis.data[f.key];
      if (v) {
        pdf.text(f.label, { bold: true, size: 10.5 });
        pdf.text(v, { gap: 6 });
      }
    }
    pdf.rule();
  }

  pdf.heading(`Evoluções (${records.length})`);
  for (const r of [...records].reverse()) {
    pdf.text(`${r.title || 'Evolução'}${r.retractedAt ? '  [INVALIDADO]' : ''}`, {
      bold: true,
      size: 12,
    });
    pdf.text(
      `${r.sessionDate ? `Sessão de ${fmtDateTime(r.sessionDate)} · ` : ''}Registrado em ${fmtDateTime(r.createdAt)} · versão ${r.version}${r.version > 1 ? ` (retificado em ${fmtDateTime(r.updatedAt)})` : ''}`,
      { size: 9, color: [0.4, 0.4, 0.38], gap: 3 },
    );
    pdf.text(htmlToText(r.html), { gap: 4 });
    if (r.retractedAt)
      pdf.text(`Motivo da invalidação: ${r.retractedReason ?? ''}`, {
        size: 9.5,
        color: [0.7, 0.15, 0.1],
      });
    pdf.rule();
  }

  const bytes = await pdf.save();
  await audit({
    action: 'CLINICAL_RECORD_EXPORT',
    actorId: user.id,
    actorRole: user.role,
    entity: 'PatientProfile',
    entityId: id,
    metadata: { records: records.length },
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prontuario-${id.slice(-6)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
