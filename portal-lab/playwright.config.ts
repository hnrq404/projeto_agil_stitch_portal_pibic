import { defineConfig } from "@playwright/test";

/**
 * E2E da Sprint 3. O webServer sobe `npm run dev:all` (frontend :5173 +
 * backend Convex local) automaticamente — inclusive no CI. Localmente,
 * `reuseExistingServer` reaproveita um dev server já rodando (ex.: preview).
 * Requer as variáveis de auth do Convex configuradas (run doc §1.4).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:all",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  retries: process.env.CI ? 1 : 0,
});
