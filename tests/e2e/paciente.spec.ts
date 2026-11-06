import { expect, test } from '@playwright/test';
import { login, waitForMailLink } from './helpers';

const EMAIL = `paciente.e2e.${Date.now()}@exemplo.com`;
const PASSWORD = 'Senha12345';

test.describe('Fluxo do paciente: cadastro → confirmação → agendamento', () => {
  test('cadastro, confirmação de e-mail, login e agendamento', async ({ page }) => {
    // 1) Cadastro com aceite de termos
    await page.goto('/cadastro');
    await page.locator('#fullName').fill('Paciente E2E Teste');
    await page.locator('#email').fill(EMAIL);
    await page.locator('#phone').fill('(11) 91234-5678');
    await page.locator('#birthDate').fill('1990-05-10');
    await page.locator('#password').fill(PASSWORD);
    await page.locator('#confirmPassword').fill(PASSWORD);

    // Sem aceitar os termos, o envio é bloqueado
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.getByText(/necessário aceitar o Termo de Consentimento/)).toBeVisible();

    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.getByText('Verifique seu e-mail')).toBeVisible();

    // 2) Antes de confirmar o e-mail, não é possível agendar
    await login(page, EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/paciente/);
    await expect(page.getByText('Confirme seu e-mail para poder agendar')).toBeVisible();

    // 3) Confirma o e-mail pelo link recebido
    const link = await waitForMailLink(EMAIL, 'Confirme seu e-mail');
    await page.goto(link);
    await page.getByRole('button', { name: 'Confirmar meu e-mail' }).click();
    await expect(page.getByText('E-mail confirmado!').first()).toBeVisible();

    // 4) Agenda uma sessão (aprovação manual por padrão → "aguardando confirmação")
    await page.goto('/paciente/agendar');
    await expect(page.getByRole('listbox', { name: 'Horários disponíveis' })).toBeVisible({
      timeout: 20_000,
    });
    await page
      .getByRole('option')
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Solicitar este horário|Confirmar agendamento/ })
      .click();
    await expect(page.getByText(/Pedido enviado|Sessão agendada/).first()).toBeVisible({
      timeout: 20_000,
    });

    // 5) A sessão aparece em "Minhas sessões"
    await page.goto('/paciente/sessoes');
    await expect(page.getByText(/Aguardando confirmação|Agendada/).first()).toBeVisible();
  });

  test('paciente não acessa o painel administrativo', async ({ page }) => {
    await login(page, EMAIL, PASSWORD);
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
    const res = await page.request.get('/api/export/financeiro');
    expect(res.status()).toBe(404);
  });

  test('senha errada mostra erro genérico', async ({ page }) => {
    await login(page, EMAIL, 'SenhaErrada1');
    await expect(page.getByText('E-mail ou senha incorretos.').first()).toBeVisible();
  });
});
