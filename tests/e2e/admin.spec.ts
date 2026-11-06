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

test.describe('Aurora – assistente da psicóloga', () => {
  test('cadastra um paciente conversando e ele aparece na lista', async ({ page }) => {
    // Nomes não têm dígitos: o sufixo único é feito só de letras
    const nome = `Paciente Chat ${[...String(Date.now())].map((d) => 'Abcdefghij'[Number(d)]).join('')}`;
    await login(page, 'admin@consultorio.local', 'Troque123senha');
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('button', { name: /Abrir Aurora/ }).click();
    const caixa = page.getByLabel('Mensagem para a assistente');

    await caixa.fill('Quem eu vou atender hoje?');
    await caixa.press('Enter');
    await expect(page.getByText(/sessões hoje|não tem sessões/i).first()).toBeVisible();

    await caixa.fill(`Cadastrar paciente ${nome}, telefone (11) 97777-1234, nascimento 25/08/1992`);
    await caixa.press('Enter');
    // Faltou o e-mail: a Aurora pergunta; a psicóloga escolhe pular
    await expect(page.getByText(/Qual o e-mail|E o e-mail/)).toBeVisible();
    await page.getByRole('button', { name: 'Pular' }).click();
    await expect(page.getByText('Posso salvar este cadastro?')).toBeVisible();
    // Antes de confirmar, nada foi gravado
    const antes = await page.request.get('/admin/pacientes?q=' + encodeURIComponent(nome));
    expect(await antes.text()).toContain('Nenhum paciente encontrado');

    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByText(/foi cadastrado\(a\)/)).toBeVisible();

    await page.goto('/admin/pacientes?q=' + encodeURIComponent(nome));
    await expect(page.getByRole('link', { name: nome })).toBeVisible();
  });
});

test.describe('Aurora – assistente do paciente', () => {
  test('mostra o aviso de crise e não permite cadastrar pacientes', async ({ page }) => {
    const email = `chat.e2e.${Date.now()}@exemplo.com`;
    await page.goto('/cadastro');
    await page.locator('#fullName').fill('Paciente Chat E2E');
    await page.locator('#email').fill(email);
    await page.locator('#phone').fill('(11) 91234-5678');
    await page.locator('#birthDate').fill('1990-05-10');
    await page.locator('#password').fill('Senha12345');
    await page.locator('#confirmPassword').fill('Senha12345');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.getByText('Verifique seu e-mail')).toBeVisible();
    await login(page, email, 'Senha12345');
    await expect(page).toHaveURL(/\/paciente/);

    await page.getByRole('button', { name: /Abrir Aurora/ }).click();
    const caixa = page.getByLabel('Mensagem para a assistente');
    await caixa.fill('não aguento mais, quero morrer');
    await caixa.press('Enter');
    await expect(page.getByText(/CVV – 188/)).toBeVisible();

    await caixa.fill('cadastrar paciente Invasor Teste');
    await caixa.press('Enter');
    await expect(
      page.getByText(/Não tenho certeza de ter entendido|Posso ajudar/).first(),
    ).toBeVisible();
  });
});
