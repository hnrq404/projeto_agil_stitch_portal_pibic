import { expect, type Browser, type Page } from '@playwright/test';

/** Contas criadas pelo seed (server/src/infra/seed.ts). */
export const CONTAS = {
  gestor: { email: 'gestor@pibic.edu.br', senha: 'gestor123' },
  docente: { email: 'docente@pibic.edu.br', senha: 'docente123', nome: 'Prof. Roberto Alencar' },
  avaliador: { email: 'avaliador@pibic.edu.br', senha: 'avaliador123', nome: 'Dra. Carla Avaliadora' },
} as const;

/** PDF mínimo válido (assinatura %PDF-) para os uploads. */
export function pdf(nome: string) {
  return {
    name: nome,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
  };
}

/** Cada papel numa sessão isolada (contexto próprio = localStorage próprio). */
export async function sessao(browser: Browser, conta: { email: string; senha: string }): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await entrar(page, conta);
  return page;
}

export async function entrar(page: Page, conta: { email: string; senha: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(conta.email);
  await page.getByLabel('Senha').fill(conta.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Data local no formato do input type="date". */
export function dataInput(diasAPartirDeHoje: number): string {
  const d = new Date(Date.now() + diasAPartirDeHoje * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
