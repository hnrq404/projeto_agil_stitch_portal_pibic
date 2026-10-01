import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E — roda contra o servidor full-stack (API + SPA de web/dist) na porta 3000.
 * O webServer aplica o seed (contas por papel) antes de subir a API.
 * Requisito: `npm run build` no web/ (a API serve o dist). Defina E2E_NO_SERVER=1
 * para reaproveitar um servidor já rodando.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    viewport: { width: 1366, height: 900 },
  },
  webServer: process.env['E2E_NO_SERVER']
    ? undefined
    : {
        command: 'npm run db:seed --prefix ../server && npm run dev --prefix ../server',
        url: 'http://localhost:3000/api/health',
        reuseExistingServer: true,
        timeout: 90_000,
      },
});
