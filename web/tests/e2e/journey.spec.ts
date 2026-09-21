import { test, expect } from '@playwright/test';

import { register, login } from './helpers/ui';

/**
 * E2E (Browser) — Jornada completa da Sprint 2:
 *   1. cadastra conta GESTOR pela UI
 *   2. faz login pela UI (redirecionamento inteligente)
 *   3. cria edital com cotas por subárea CNPq
 *   4. valida em tempo real a regra da soma de cotas (bloqueio na UI)
 *   5. publica o edital ("Salvar e Publicar")
 *   6. navega até a vitrine pública e vê o edital publicado
 */
test('jornada: cadastro → login → criar edital → cotas → publicar → vitrine', async ({ page }) => {
  const email = `gestor.ui.${Date.now()}@pibic.edu.br`;

  // ── 1. Cadastro pela UI
  await register(page, { nome: 'Gestor UI', email, senha: 'senha123', role: 'GESTOR' });
  await expect(page).toHaveURL(/\/gestor\/editais/);

  // Sair para exercitar o login
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/editais/);

  // ── 2. Login pela UI → redireciona GESTOR para o painel
  await login(page, { email, senha: 'senha123' });
  await expect(page).toHaveURL(/\/gestor\/editais/);
  await expect(page.getByText('Gestor UI')).toBeVisible();

  // ── 3. Criar edital
  await page.getByRole('link', { name: '+ Criar Novo Edital' }).click();
  await expect(page).toHaveURL(/\/gestor\/editais\/novo/);

  await page.getByLabel('Número do edital').fill(`UI/${Date.now()}`);
  await page.getByLabel('Título').fill('Edital PIBIC via UI 2026/2027');
  await page.getByLabel('Descrição').fill('Criado pelo teste E2E de browser.');
  await page.getByLabel('Total de bolsas').fill('4');
  const dataFim = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.getByLabel('Início das inscrições').fill('2026-10-01');
  await page.getByLabel('Fim das inscrições').fill(dataFim);

  // Cota inicial já existe (1.03, qtd 1) — ajusta para 2
  await page.getByLabel('Quantidade de bolsas').first().fill('2');

  // ── 4. Validação em tempo real: soma 2 de 4 → informativo
  await expect(page.getByTestId('soma-cotas')).toContainText('restam 2');

  // Segunda cota excedente (2+3=5 > 4) → bloqueio visível + botões desabilitados
  await page.getByRole('button', { name: '+ Adicionar cota por subárea' }).click();
  const segundaCota = page.getByLabel('Quantidade de bolsas').nth(1);
  await segundaCota.fill('3');
  await expect(page.getByTestId('soma-cotas')).toContainText('EXCEDE');
  await expect(page.getByRole('button', { name: 'Salvar Rascunho' })).toBeDisabled();

  // Corrige: segunda cota = 2 → soma 4 de 4 (distribuição completa)
  await segundaCota.fill('2');
  await expect(page.getByTestId('soma-cotas')).toContainText('distribuição completa');

  // Subáreas distintas (a primeira já é 1.03 — Ciência da Computação)
  await page.getByLabel('Subárea CNPq').nth(1).selectOption({ index: 2 });

  // ── 5. Salvar e Publicar
  await page.getByRole('button', { name: 'Salvar e Publicar' }).click();
  await expect(page).toHaveURL(/\/gestor\/editais$/, { timeout: 15000 });

  // ── 6. Vitrine pública mostra o edital publicado
  await page.getByRole('link', { name: 'Ver Vitrine Pública' }).click();
  await expect(page).toHaveURL(/\/editais$/);
  await expect(page.getByText('Edital PIBIC via UI 2026/2027')).toBeVisible();

  // Detalhe público acessível
  await page.getByRole('link', { name: 'Ver Detalhes' }).first().click();
  await expect(page.getByText('Cotas por subárea CNPq')).toBeVisible();
  await expect(page.getByText('Ciência da Computação')).toBeVisible();
});
