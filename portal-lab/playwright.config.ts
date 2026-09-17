import { defineConfig } from "@playwright/test";

/**
 * E2E assume o dev server já rodando (`npm run dev:all` — frontend :5173 +
 * backend Convex local) com as variáveis de auth configuradas (run doc §1).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  retries: process.env.CI ? 1 : 0,
});
