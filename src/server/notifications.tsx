import 'server-only';
import { render } from '@react-email/render';
import { EmailLayout } from '@/emails/layout';
import { db } from '@/lib/db';
import { EMAIL_TEMPLATE_DEFAULTS } from '@/lib/defaults';
import { sendMail, type MailAttachment, type MailResult } from '@/lib/mailer';
import { getClinic } from '@/lib/settings';
import { blocksToText, interpolate, parseBody } from '@/lib/template-engine';

export interface SendTemplateInput {
  templateKey: string;
  to: string;
  vars?: Record<string, string | undefined>;
  userId?: string;
  appointmentId?: string;
  /** Evita envio duplicado (ex.: lembretes). */
  dedupeKey?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
}

/**
 * Renderiza um template editável (banco) dentro do layout React Email e envia.
 * Cada envio fica registrado em NotificationLog (sem o corpo do e-mail).
 */
export async function sendTemplateEmail(input: SendTemplateInput): Promise<MailResult> {
  const [tpl, clinic] = await Promise.all([
    db.emailTemplate.findUnique({ where: { key: input.templateKey } }),
    getClinic(),
  ]);
  const template = tpl ?? EMAIL_TEMPLATE_DEFAULTS.find((t) => t.key === input.templateKey);
  if (!template) return { ok: false, error: `Template inexistente: ${input.templateKey}` };
  if (tpl && !tpl.active) return { ok: true, providerId: 'template-desativado' };

  const vars: Record<string, string | undefined> = {
    consultorio: clinic.clinicName,
    profissional: clinic.professionalName,
    ...input.vars,
  };
  const subject = interpolate(template.subject, vars)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 200);
  const blocks = parseBody(template.body, vars);

  // Deduplicação: cria o log primeiro; a constraint única impede duas execuções concorrentes.
  let logId: string | undefined;
  if (input.dedupeKey) {
    try {
      const created = await db.notificationLog.create({
        data: {
          dedupeKey: input.dedupeKey,
          template: input.templateKey,
          toEmail: input.to,
          subject,
          userId: input.userId,
          appointmentId: input.appointmentId,
        },
      });
      logId = created.id;
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
      const existing = await db.notificationLog.findUnique({
        where: { dedupeKey: input.dedupeKey },
      });
      if (!existing || existing.status !== 'FALHA')
        return { ok: true, providerId: 'duplicado-ignorado' };
      logId = existing.id; // tentativa anterior falhou → tenta de novo
    }
  } else {
    const created = await db.notificationLog.create({
      data: {
        template: input.templateKey,
        toEmail: input.to,
        subject,
        userId: input.userId,
        appointmentId: input.appointmentId,
      },
    });
    logId = created.id;
  }

  const html = await render(
    <EmailLayout
      clinicName={clinic.clinicName}
      professionalName={clinic.professionalName}
      crp={clinic.crp}
      preview={subject}
      blocks={blocks}
    />,
  );
  const text = blocksToText(blocks);

  const result = await sendMail({
    to: input.to,
    subject,
    html,
    text,
    attachments: input.attachments,
    replyTo: input.replyTo ?? (clinic.email || undefined),
  });

  await db.notificationLog.update({
    where: { id: logId },
    data: {
      status: result.ok ? 'ENVIADO' : 'FALHA',
      providerId: result.providerId,
      error: result.ok ? null : (result.error ?? 'erro desconhecido').slice(0, 200),
    },
  });
  return result;
}
