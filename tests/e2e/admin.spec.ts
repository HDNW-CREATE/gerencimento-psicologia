import { expect, test } from '@playwright/test';
import { login, nextMondayLocal } from './helpers';

const PACIENTE = `Paciente Admin E2E ${Date.now()}`;

test.describe('Fluxo da psicóloga: login → sessão → prontuário', () => {
  test('cria paciente, agenda sessão e registra evolução criptografada', async ({ page }) => {
    await login(page, 'admin@consultorio.local', 'Troque123senha');
    await expect(page).toHaveURL(/\/admin/);

    // Cadastro do paciente
    await page.goto('/admin/pacientes/novo');
    await page.locator('#fullName').fill(PACIENTE);
    await page.getByRole('button', { name: 'Cadastrar paciente' }).click();
    await expect(page.getByRole('heading', { name: PACIENTE })).toBeVisible({ timeout: 20_000 });
    const patientUrl = page.url();

    // Cria sessão na agenda
    await page.goto('/admin/agenda');
    await page.getByRole('button', { name: 'Nova sessão' }).click();
    await page.locator('#c-filter').fill('Admin E2E');
    await page.getByLabel('Selecionar paciente').selectOption({ label: PACIENTE });
    await page.locator('#c-when').fill(nextMondayLocal(10));
    await page.getByRole('button', { name: 'Criar sessão' }).click();
    await expect(page.getByText(/sessão\(ões\) criada\(s\)/)).toBeVisible({ timeout: 20_000 });

    // A sessão aparece na ficha do paciente
    await page.goto(patientUrl);
    await expect(page.getByText(/Terapia individual/).first()).toBeVisible();

    // Registra evolução no prontuário (texto rico)
    await page.getByRole('link', { name: /Prontuário/ }).click();
    await expect(page.getByText(/Conteúdo criptografado/)).toBeVisible();
    const editor = page.getByRole('textbox', { name: 'Texto da evolução' });
    await editor.click();
    await page.keyboard.type('Paciente relatou melhora do sono. Registro E2E.');
    await page.getByRole('button', { name: 'Salvar evolução' }).click();
    await expect(page.getByText('Evolução registrada (criptografada).')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Paciente relatou melhora do sono. Registro E2E.')).toBeVisible();

    // Retificação exige motivo e preserva o histórico
    await page.getByRole('button', { name: 'Retificar' }).first().click();
    await expect(page.getByRole('button', { name: 'Salvar nova versão' })).toBeDisabled();
    await page.getByLabel('Motivo da retificação *').fill('Ajuste de redação');
    await page.getByRole('textbox', { name: 'Texto retificado' }).click();
    await page.keyboard.type(' Complemento.');
    await page.getByRole('button', { name: 'Salvar nova versão' }).click();
    await expect(page.getByText(/Registro retificado/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Histórico' }).first().click();
    await expect(page.getByText('versão original')).toBeVisible();

    // O PDF do prontuário é gerado
    const pdf = await page.request.get(`/api/export/prontuario/${patientUrl.split('/').pop()}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
  });

  test('painel mostra indicadores e a página pública carrega', async ({ page }) => {
    await login(page, 'admin@consultorio.local', 'Troque123senha');
    await expect(page.getByText('Indicadores do mês')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Agendar sessão' }).first()).toBeVisible();
  });
});
