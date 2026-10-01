import { expect, test } from "@playwright/test";

/**
 * S3 — E2E da jornada completa do discente (cadastro → nova inscrição →
 * anexos → submissão → protocolo no detalhe). Requer o backend local
 * (`npm run dev:all`) e variáveis de auth configuradas (ver run doc).
 */
test("discente submete proposta completa com plano de trabalho", async ({ page }) => {
  const email = `aluno.s3.${Date.now()}@universidade.br`;

  // 1. Cadastro (aluno é liberado automaticamente)
  await page.goto("/cadastro");
  await page.getByLabel("Nome Completo").fill("Aluno Sprint 3");
  await page.getByLabel("Matrícula / SIAPE").fill("2026001234");
  await page.getByLabel("E-mail Institucional").fill(email);
  await page.getByLabel("Senha", { exact: false }).first().fill("SenhaForte123");
  await page.getByRole("button", { name: /Finalizar Cadastro/i }).click();

  // 2. Landing do papel → Minhas Inscrições
  await expect(page).toHaveURL(/minhas-inscricoes/);
  await expect(page.getByRole("heading", { name: /Minhas Inscrições/i })).toBeVisible();

  // 3. Nova inscrição: escolhe edital (seed de demo) e preenche a etapa 1
  await page.getByRole("link", { name: /Nova Inscrição/i }).first().click();
  await page.getByLabel(/Edital/).selectOption({ index: 1 });
  await page.getByLabel(/Título Oficial/i).fill("Detecção de leucemia por visão computacional");
  await page.getByLabel(/Grande Área CNPq/).selectOption({ index: 1 });
  await page.getByLabel(/Professor Orientador/).selectOption({ index: 1 });
  await page.getByLabel(/Resumo da Proposta/).fill(
    "Uso de redes neurais convolucionais para triagem automática de lâminas de sangue periférico em hospitais de média complexidade, reduzindo o tempo de diagnóstico.",
  );
  await page.getByLabel(/Palavras-chave/).fill("visão computacional, hematologia, triagem");
  await page.getByRole("button", { name: /Avançar/i }).click();

  // 4. Etapa 2 — projeto
  await page.getByLabel(/Metodologia/i).fill(
    "Fine-tuning de ResNet-50 pré-treinada em ImageNet com aumento de dados especializado (rotação, elástico) e validação cruzada 5-fold sobre o dataset público ALL-IDB, com métricas de sensibilidade e especificidade por classe de célula.",
  );
  await page.getByLabel(/Cronograma/i).fill(
    "Meses 1–3: curadoria do dataset; Meses 4–8: experimentos e validação; Meses 9–12: redação do artigo e apresentação no SIC.",
  );
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

  // 6. Etapa 4 — revisão, declaração e submissão via modal do design system
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
