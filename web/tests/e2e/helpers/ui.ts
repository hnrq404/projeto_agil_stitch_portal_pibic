import type { Page } from '@playwright/test';

/** Helpers de UI reutilizados pelos testes E2E. */

export async function register(
  page: Page,
  input: { nome: string; email: string; senha: string; role: 'GESTOR' | 'USUARIO' },
): Promise<void> {
  await page.goto('/cadastro');
  await page.getByLabel('Nome completo').fill(input.nome);
  await page.getByLabel('E-mail').fill(input.email);
  await page.getByLabel('Senha', { exact: true }).fill(input.senha);
  await page.getByLabel('Confirmar senha').fill(input.senha);
  if (input.role === 'GESTOR') {
    await page.getByLabel('Gestor', { exact: true }).check();
  } else {
    await page.getByRole('radio', { name: 'Visitante' }).check();
  }
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await page.waitForURL(/\/gestor\/editais|\/editais/);
}

export async function login(page: Page, input: { email: string; senha: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(input.email);
  await page.getByLabel('Senha').fill(input.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/gestor\/editais|\/editais/);
}
