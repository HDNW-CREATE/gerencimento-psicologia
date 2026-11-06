'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { audit } from '@/lib/audit';
import { generateToken, hashToken } from '@/lib/crypto';
import { db } from '@/lib/db';
import { appUrl } from '@/lib/env';
import { rateLimit, rateLimitByIp, rateLimitMessage } from '@/lib/ratelimit';
import { getClientIp, getUserAgent } from '@/lib/request';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/schemas/auth';
import { fail, ok, run, UserError, type ActionResult } from '../action-result';
import { sendTemplateEmail } from '../notifications';
import { requireUserOrThrow } from '../session';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

/** Aceita apenas caminhos internos (evita open redirect). */
function safeCallback(url: string | undefined, fallback: string): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return fallback;
  return url;
}

/* ───────────────────────────── Login ───────────────────────────── */

export async function loginAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return run(async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) return fail('Informe e-mail e senha válidos.');
    const { email, password, callbackUrl } = parsed.data;

    try {
      await signIn('credentials', { email, password, redirect: false });
    } catch (err) {
      if (err instanceof AuthError) {
        const code = (err as { code?: string }).code;
        if (code === 'rate_limited') {
          return fail('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        }
        return fail('E-mail ou senha incorretos.');
      }
      throw err;
    }

    const user = await db.user.findUnique({ where: { email }, select: { role: true } });
    const home = user?.role === 'PACIENTE' ? '/paciente' : '/admin';
    const target = safeCallback(callbackUrl, home);
    // Não deixa paciente cair em /admin nem equipe em /paciente via callbackUrl
    const allowed =
      home === '/admin' ? target.startsWith('/admin') : target.startsWith('/paciente');
    return ok(undefined, { redirectTo: allowed ? target : home });
  });
}

export async function logoutAction() {
  await signOut({ redirectTo: '/' });
}

/** Encerra TODAS as sessões (todos os dispositivos) invalidando os JWT já emitidos. */
export async function logoutAllAction() {
  const user = await requireUserOrThrow();
  await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  await audit({ action: 'LOGOUT_ALL', actorId: user.id, actorRole: user.role });
  await signOut({ redirectTo: '/entrar?saiu=1' });
}

/* ───────────────────────────── Cadastro ───────────────────────────── */

async function issueVerificationToken(userId: string): Promise<string> {
  const { token, hash } = generateToken();
  await db.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() }, // invalida pendentes
  });
  await db.emailVerificationToken.create({
    data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
  });
  return token;
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const rl = await rateLimitByIp('register', 5, 60 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));

    const data = registerSchema.parse(input);
    const genericOk = ok(
      'Cadastro enviado! Se o e-mail ainda não possuir conta, enviamos um link de confirmação. Se você já tem conta, use "Esqueci minha senha".',
    );

    // Anti-enumeração: resposta idêntica quando o e-mail já existe.
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return genericOk;

    if (data.cpf) {
      const cpfTaken = await db.patientProfile.findUnique({ where: { cpf: data.cpf } });
      if (cpfTaken) {
        throw new UserError(
          'Não foi possível usar este CPF. Deixe o campo em branco ou fale com o consultório.',
          {
            cpf: ['CPF indisponível.'],
          },
        );
      }
    }

    // Documentos legais vigentes (a versão aceita é gravada pelo SERVIDOR, não pelo cliente)
    const legal = await Promise.all(
      (['TERMO_CONSENTIMENTO', 'POLITICA_PRIVACIDADE', 'TERMOS_DE_USO'] as const).map((type) =>
        db.legalDocument.findFirst({ where: { type }, orderBy: { version: 'desc' } }),
      ),
    );
    const ip = await getClientIp();
    const userAgent = await getUserAgent();

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.socialName ?? data.fullName,
        passwordHash,
        role: 'PACIENTE',
        patientProfile: {
          create: {
            fullName: data.fullName,
            socialName: data.socialName,
            email: data.email,
            phone: data.phone,
            birthDate: new Date(`${data.birthDate}T00:00:00Z`),
            cpf: data.cpf,
            guardianName: data.guardianName,
            guardianCpf: data.guardianCpf,
            guardianPhone: data.guardianPhone,
            guardianEmail: data.guardianEmail,
          },
        },
        consents: {
          create: legal
            .filter((l): l is NonNullable<typeof l> => !!l)
            .map((l) => ({ legalDocumentId: l.id, ip, userAgent })),
        },
      },
    });

    const token = await issueVerificationToken(user.id);
    await sendTemplateEmail({
      templateKey: 'welcome_verify',
      to: user.email,
      userId: user.id,
      vars: {
        nome: data.socialName ?? data.fullName,
        link: `${appUrl()}/verificar-email?token=${token}`,
      },
    });
    await audit({ action: 'REGISTER', actorId: user.id, actorRole: 'PACIENTE' });
    return genericOk;
  });
}

/* ───────────────────────────── Confirmação de e-mail ───────────────────────────── */

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  return run(async () => {
    const rl = await rateLimitByIp('verify-email', 20, 60 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));

    const row = await db.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return fail('Link inválido ou expirado. Solicite um novo link de confirmação.');
    }

    await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
        include: { patientProfile: true },
      });
      await tx.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });

      // Vincula ficha criada previamente pela psicóloga (cadastro rápido) com o MESMO e-mail.
      // Só agora (e-mail confirmado) para ninguém "sequestrar" ficha alheia só digitando o e-mail.
      const mine = user.patientProfile;
      if (user.role === 'PACIENTE' && mine) {
        const prior = await tx.patientProfile.findFirst({
          where: { userId: null, deletedAt: null, email: user.email, id: { not: mine.id } },
        });
        if (prior) {
          // A ficha nova está vazia de histórico: transfere seus dados para a antiga e descarta a nova.
          await tx.patientProfile.delete({ where: { id: mine.id } });
          await tx.patientProfile.update({
            where: { id: prior.id },
            data: {
              userId: user.id,
              socialName: prior.socialName ?? mine.socialName,
              phone: prior.phone ?? mine.phone,
              birthDate: prior.birthDate ?? mine.birthDate,
              cpf: prior.cpf ?? mine.cpf,
              guardianName: prior.guardianName ?? mine.guardianName,
              guardianCpf: prior.guardianCpf ?? mine.guardianCpf,
              guardianPhone: prior.guardianPhone ?? mine.guardianPhone,
              guardianEmail: prior.guardianEmail ?? mine.guardianEmail,
            },
          });
        }
      }
    });

    await audit({ action: 'EMAIL_VERIFIED', actorId: row.userId });
    return ok('E-mail confirmado com sucesso!');
  });
}

export async function resendVerificationAction(): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUserOrThrow();
    if (user.emailVerifiedAt) return ok('Seu e-mail já está confirmado.');
    const rl = await rateLimit(`resend-verify:${user.id}`, 3, 60 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));

    const token = await issueVerificationToken(user.id);
    await sendTemplateEmail({
      templateKey: 'welcome_verify',
      to: user.email,
      userId: user.id,
      vars: { nome: user.name, link: `${appUrl()}/verificar-email?token=${token}` },
    });
    return ok('Enviamos um novo link para o seu e-mail.');
  });
}

/* ───────────────────────────── Recuperação de senha ───────────────────────────── */

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const rl = await rateLimitByIp('forgot', 5, 60 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));
    const { email } = forgotPasswordSchema.parse(input);

    const rlEmail = await rateLimit(`forgot:email:${email}`, 3, 60 * 60);
    const generic = ok(
      'Se o e-mail estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 1 hora.',
    );
    if (!rlEmail.allowed) return generic;

    const user = await db.user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const { token, hash } = generateToken();
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await db.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      await sendTemplateEmail({
        templateKey: 'password_reset',
        to: user.email,
        userId: user.id,
        vars: { nome: user.name, link: `${appUrl()}/redefinir-senha?token=${token}` },
      });
      await audit({ action: 'PASSWORD_RESET_REQUEST', actorId: user.id, actorRole: user.role });
    }
    return generic;
  });
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const rl = await rateLimitByIp('reset', 10, 60 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));

    const data = resetPasswordSchema.parse(input);
    const row = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(data.token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return fail('Link inválido ou expirado. Solicite uma nova redefinição.');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    await db.$transaction([
      db.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 }, // derruba sessões antigas
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    await audit({ action: 'PASSWORD_RESET_DONE', actorId: row.userId });
    return ok('Senha alterada! Faça login com a nova senha.');
  });
}

/* ───────────────────────────── Trocar senha (logado) ───────────────────────────── */

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUserOrThrow();
    const rl = await rateLimit(`change-pass:${user.id}`, 5, 15 * 60);
    if (!rl.allowed) return fail(rateLimitMessage(rl));

    const data = changePasswordSchema.parse(input);
    const okPass = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!okPass)
      return fail('A senha atual está incorreta.', { currentPassword: ['Senha atual incorreta.'] });

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(data.password, 12),
        sessionVersion: { increment: 1 },
      },
    });
    await audit({ action: 'PASSWORD_CHANGED', actorId: user.id, actorRole: user.role });
    return ok('Senha alterada. Por segurança, faça login novamente.');
  });
}
