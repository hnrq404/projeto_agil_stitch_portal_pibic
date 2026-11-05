import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * S3 — E2E da jornada completa do discente (cadastro → nova inscrição →
 * anexos → submissão → protocolo no detalhe). Requer o backend local
 * (`npm run dev:all`) e variáveis de auth configuradas (ver run doc).
 */
test("discente submete proposta completa com plano de trabalho", async ({ page, browser }) => {
  const email = `aluno.s3.${Date.now()}@universidade.br`;
  const gestorEmail = process.env.PLAYWRIGHT_GESTOR_EMAIL ?? "gestor.e2e@universidade.br";
  const orientadorEmail = "orientador.e2e@universidade.br";
  const senhaTeste = "SenhaForte123";
  const registerAccount = async (
    targetPage: Page,
    name: string,
    accountEmail: string,
    asOrientador = false,
  ) => {
    await targetPage.goto("/cadastro");
    await targetPage.getByLabel("Nome Completo").fill(name);
    await targetPage.getByLabel("Matrícula ou SIAPE").fill("2026001234");
    await targetPage.getByLabel("E-mail Institucional").fill(accountEmail);
    await targetPage.getByLabel("Senha", { exact: false }).first().fill(senhaTeste);
    if (asOrientador) {
      await targetPage.getByRole("radio", { name: /Professor Orientador/i }).check();
    }
    await targetPage
      .getByRole("checkbox", { name: /Declaro que as informações acima são verdadeiras/i })
      .check();
    await targetPage.getByRole("button", { name: /Criar minha conta/i }).click();
  };
  const login = async (targetPage: Page, accountEmail: string) => {
    await targetPage.goto("/login");
    await targetPage.getByLabel(/E-mail institucional/i).fill(accountEmail);
    await targetPage.getByLabel("Senha", { exact: false }).first().fill(senhaTeste);
    await targetPage.getByRole("button", { name: /^Entrar$/i }).click();
  };
  const gestorContext = await browser.newContext({ baseURL: "http://localhost:5173" });
  const gestorPage = await gestorContext.newPage();

  // 1. Provisiona o edital demo pela interface de gestão quando a base está vazia.
  await page.goto("/editais-abertos");
  await expect(page.getByRole("heading", { name: /Editais abertos/i })).toBeVisible();
  await expect(page.getByText("Carregando editais…")).toBeHidden();
  const noOpenEdital = page.getByRole("heading", { name: "Nenhum edital aberto no momento" });
  if (await noOpenEdital.isVisible()) {
    await registerAccount(gestorPage, "Gestor de demonstração", gestorEmail);
    await expect(gestorPage).toHaveURL(/minhas-inscricoes/);
    await gestorPage.getByRole("button", { name: /Assumir a gestão do portal/i }).click();
    await gestorPage.getByRole("button", { name: /Sim, assumir gestão/i }).click();
    await gestorPage.goto("/nova-inscricao");
    await gestorPage.getByRole("button", { name: /Carregar edital de demonstração/i }).click();
    await expect(gestorPage.getByLabel(/Edital/)).toBeVisible();
  } else {
    await login(gestorPage, gestorEmail);
    await expect(gestorPage).toHaveURL(/dashboard/);
    await gestorPage.goto("/nova-inscricao");
  }

  const orientadorOptions = gestorPage.getByLabel(/Professor Orientador/).locator("option");
  if ((await orientadorOptions.count()) < 2) {
    const orientadorContext = await browser.newContext({ baseURL: "http://localhost:5173" });
    const orientadorPage = await orientadorContext.newPage();
    try {
      await login(orientadorPage, orientadorEmail);
      await expect(orientadorPage).toHaveURL(/meus-projetos|minhas-inscricoes/, { timeout: 5_000 });
    } catch {
      await registerAccount(orientadorPage, "Orientador E2E", orientadorEmail, true);
      await expect(orientadorPage).toHaveURL(/meus-projetos|minhas-inscricoes/);
    }
    await orientadorContext.close();

    await gestorPage.goto("/gestao-usuarios");
    await expect(gestorPage.getByRole("heading", { name: "Gestão de Usuários" })).toBeVisible();
    const pedidoOrientador = gestorPage.locator("li").filter({ hasText: orientadorEmail });
    if (await pedidoOrientador.isVisible()) {
      await pedidoOrientador.getByRole("button", { name: "Aprovar" }).click();
      const dialogAprovacao = gestorPage.getByRole("dialog", { name: /Aprovar pedido de acesso/i });
      await dialogAprovacao.getByRole("button", { name: "Aprovar" }).click();
      await expect(
        gestorPage.getByText(/Pedido aprovado: Orientador E2E agora é Professor Orientador/i),
      ).toBeVisible();
    }
    await gestorPage.goto("/nova-inscricao");
    await expect(
      gestorPage.getByLabel(/Professor Orientador/).locator("option").filter({ hasText: /Orientador E2E/ }),
    ).toBeAttached();
  }

  await gestorPage.goto("/nova-inscricao");
  await expect(gestorPage.getByLabel(/Professor Orientador/).locator("option").nth(1)).toBeAttached();
  // 2. Cadastro do discente que percorrerá a jornada completa.
  await registerAccount(page, "Aluno Sprint 3", email);

  // 3. Landing do papel → Minhas Inscrições
  await expect(page).toHaveURL(/minhas-inscricoes/);
  await expect(page.getByRole("heading", { name: /Minhas Inscrições/i })).toBeVisible();

  // 4. Nova inscrição: escolhe o edital e preenche a etapa 1
  await page.getByRole("link", { name: /Nova Inscrição/i }).first().click();
  await page.getByLabel(/Edital/).selectOption({ index: 1 });
  await page.getByLabel(/Título Oficial/i).fill("Detecção de leucemia por visão computacional");
  await page.getByLabel(/Grande Área CNPq/).selectOption({ index: 1 });
  const orientadorSelect = page.getByLabel(/Professor Orientador/);
  await expect(
    orientadorSelect.locator("option").nth(1),
    "A base E2E precisa conter ao menos um docente aprovado para orientar a inscrição.",
  ).toBeAttached();
  await orientadorSelect.selectOption({ index: 1 });
  await page.getByLabel(/Resumo da Proposta/).fill(
    "Uso de redes neurais convolucionais para triagem automática de lâminas de sangue periférico em hospitais de média complexidade, reduzindo o tempo de diagnóstico.",
  );
  await page.getByLabel(/Palavras-chave/).fill("visão computacional, hematologia, triagem");
  await page.getByRole("button", { name: /Avançar/i }).click();
  const draftUrl = page.url();

  // 5. Etapa 2 — projeto
  await page.getByLabel(/Metodologia/i).fill(
    "Fine-tuning de ResNet-50 pré-treinada em ImageNet com aumento de dados especializado (rotação, elástico) e validação cruzada 5-fold sobre o dataset público ALL-IDB, com métricas de sensibilidade e especificidade por classe de célula.",
  );
  await page.getByLabel(/Cronograma/i).fill(
    "Meses 1–3: curadoria do dataset; Meses 4–8: experimentos e validação; Meses 9–12: redação do artigo e apresentação no SIC.",
  );
  await expect(page.getByText("Rascunho aguardando salvamento…")).toBeVisible();
  await expect(page.getByText("Rascunho salvo automaticamente")).toBeVisible();
  await page.getByRole("button", { name: /Avançar/i }).click();

  // 5. Etapa 3 — anexos (gera um PDF válido em runtime)
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF",
    "utf8",
  );
  await page.setInputFiles('input[type="file"]', {
    name: "plano-de-trabalho.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(page.getByText(/plano-de-trabalho\.pdf/i)).toBeVisible();
  await page.getByRole("button", { name: /Avançar/i }).click();

  // 6. O gestor aprova o vínculo depois que o discente termina de editar.
  await gestorPage.goto(draftUrl.replace("/nova-inscricao/", "/inscricoes/"));
  await gestorPage.getByRole("button", { name: /Aprovar vínculo/i }).click();
  await expect(gestorPage.getByRole("button", { name: /Aprovar vínculo/i })).toBeHidden();
  await expect(page.getByText(/vínculo aprovado/i)).toBeVisible();
  await gestorContext.close();

  // 7. Etapa 4 — revisão, declaração e submissão via modal do design system
  await page.getByLabel(/Declaro a veracidade/i).check();
  await page.getByRole("button", { name: /Submeter inscrição final/i }).click();
  await expect(page.getByRole("dialog", { name: /Confirmar submissão final/i })).toBeVisible();
  await page.getByRole("button", { name: /Confirmar e enviar/i }).click();

  // 7. Detalhe com protocolo gerado no backend (formato CNPq)
  await expect(page).toHaveURL(/inscricoes\//, { timeout: 20_000 });
  await expect(page.getByText(/Inscrição submetida com sucesso/i)).toBeVisible();
  await expect(page.locator("code.font-mono, span.font-mono").first()).toBeVisible();
  await expect(page.getByText(/Submetida ao edital/i)).toBeVisible();
});
