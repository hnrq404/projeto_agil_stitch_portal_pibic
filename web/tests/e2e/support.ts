import { expect, type Browser, type Page } from '@playwright/test';

/** Contas criadas pelo seed (server/src/infra/seed.ts). Todo professor também avalia. */
export const CONTAS = {
  gestor: { email: 'gestor.demo@unicap.br', senha: 'gestor123' },
  docente: { email: 'docente.demo@unicap.br', senha: 'docente123', nome: 'Prof. Roberto Alencar' },
  avaliadores: [
    { email: 'docente2.demo@unicap.br', senha: 'docente123', nome: 'Profa. Marina Vasconcelos' },
    { email: 'avaliador.demo@unicap.br', senha: 'docente123', nome: 'Profa. Carla Mendes' },
    { email: 'avaliador2.demo@unicap.br', senha: 'docente123', nome: 'Prof. Fernando Guimarães' },
  ],
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

/**
 * "Abre a caixa de entrada": sem servidor de e-mail no dev, a API expõe os
 * links enviados em /api/dev/emails (rota que não existe em produção).
 */
export async function linkDoEmail(page: Page, para: string): Promise<string> {
  const res = await page.request.get('/api/dev/emails');
  const { data } = (await res.json()) as { data: { para: string; texto: string }[] };
  const email = data.find((e) => e.para === para.toLowerCase());
  const link = email?.texto.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`Nenhum e-mail com link para ${para}.`);
  // O link aponta para o endereço do site configurado; o teste segue só o caminho e o token.
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

/** Data local no formato do input type="date". */
export function dataInput(diasAPartirDeHoje: number): string {
  const d = new Date(Date.now() + diasAPartirDeHoje * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
