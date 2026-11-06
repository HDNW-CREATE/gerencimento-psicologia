import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const testDb = process.env.TEST_DATABASE_URL;

/**
 * Testes ponta a ponta. Usam um banco DEDICADO (TEST_DATABASE_URL) e um servidor próprio na porta 3100.
 * Os e-mails não são enviados: vão para a pasta .dev-mail/ e os testes leem os links de lá.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/entrar`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: testDb ?? '',
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      E2E_MAIL_SINK: 'true',
      SEED_ADMIN_EMAIL: 'admin@consultorio.local',
      SEED_ADMIN_PASSWORD: 'Troque123senha',
    },
  },
});
