import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E — roda contra o servidor full-stack (API + SPA) na porta 3000.
 * Requisito: `npm run dev --prefix server` (ou build+start) já ativo.
 * Defina E2E_NO_SERVER=1 para não tentar subir o webServer próprio.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: process.env['E2E_NO_SERVER']
    ? undefined
    : {
        command: 'npm run dev --prefix ../server',
        url: 'http://localhost:3000/api/health',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
