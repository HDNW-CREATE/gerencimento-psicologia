import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resend } from 'resend';
import { env } from './env';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

export interface MailResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

let resend: Resend | undefined;

/**
 * Envia e-mail.
 *  • Com RESEND_API_KEY → Resend.
 *  • Sem chave em desenvolvimento/E2E → grava em `.dev-mail/` (e mostra no terminal), sem enviar.
 *  • Sem chave em produção → falha (registrada no NotificationLog).
 * Nunca registramos o corpo do e-mail em logs de produção (pode conter links com token).
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const e = env();

  if (e.E2E_MAIL_SINK === 'true' || (!e.RESEND_API_KEY && e.NODE_ENV !== 'production')) {
    try {
      const dir = path.join(process.cwd(), '.dev-mail');
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
      await writeFile(
        file,
        JSON.stringify(
          {
            to: msg.to,
            subject: msg.subject,
            text: msg.text,
            attachments: msg.attachments?.map((a) => a.filename),
          },
          null,
          2,
        ),
      );
      if (e.E2E_MAIL_SINK !== 'true') {
        console.warn(`[mail:dev] Para: ${msg.to} | Assunto: ${msg.subject}\n${msg.text}\n`);
      }
      return { ok: true, providerId: 'dev-sink' };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  if (!e.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY não configurada' };

  resend ??= new Resend(e.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from: e.EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error) return { ok: false, error: `${error.name}: ${error.message}`.slice(0, 200) };
    return { ok: true, providerId: data?.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 200) };
  }
}
