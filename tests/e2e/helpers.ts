import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

const MAIL_DIR = path.join(process.cwd(), '.dev-mail');

/** Procura (com tentativas) o e-mail mais recente para `to` e retorna o primeiro link http(s) do corpo. */
export async function waitForMailLink(
  to: string,
  subjectPart: string,
  timeoutMs = 20_000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const files = readdirSync(MAIL_DIR).sort().reverse();
      for (const f of files) {
        const mail = JSON.parse(readFileSync(path.join(MAIL_DIR, f), 'utf8')) as {
          to: string;
          subject: string;
          text: string;
        };
        if (mail.to === to && mail.subject.includes(subjectPart)) {
          const m = /https?:\/\/\S+/.exec(mail.text.replace(/^.*?: (https?:)/m, '$1'));
          if (m) return m[0];
        }
      }
    } catch {
      /* pasta ainda não existe */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`E-mail para ${to} com "${subjectPart}" não encontrado`);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/entrar');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Próxima segunda-feira às 10:00 (formato de <input type="datetime-local">). */
export function nextMondayLocal(hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}
