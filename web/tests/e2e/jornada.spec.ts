import { expect, test } from '@playwright/test';

import { CONTAS, dataInput, entrar, pdf, sessao } from './support';

/**
 * E2E (browser) — ciclo completo com os quatro papéis, sobre o servidor real
 * (API + SPA + SQLite com seed). Cria o próprio edital e a própria conta de
 * discente, então pode rodar várias vezes seguidas.
 */
test('ciclo completo: edital, inscrição, orientação, triagem, parecer, homologação e vitrine', async ({ browser }) => {
  test.setTimeout(120_000);
  const sufixo = Date.now().toString().slice(-6);
  const tituloEdital = `Edital E2E ${sufixo}`;
  const tituloProjeto = `Detecção de padrões em séries ecológicas ${sufixo}`;

  // ── 1. Gestor cria e publica o edital, com validação em tempo real das cotas
  const gestor = await sessao(browser, CONTAS.gestor);
  await gestor.goto('/gestor/editais/novo');
  await gestor.getByLabel('Número do edital').fill(`E2E/${sufixo}`);
  await gestor.getByLabel('Título', { exact: true }).fill(tituloEdital);
  await gestor.getByLabel('Total de bolsas').fill('2');
  await gestor.getByLabel('Início das inscrições').fill(dataInput(-1));
  await gestor.getByLabel('Fim das inscrições').fill(dataInput(30));
  await gestor.getByLabel('Quantidade de bolsas').first().fill('3');
  await expect(gestor.getByTestId('soma-cotas')).toContainText('EXCEDE');
  await expect(gestor.getByRole('button', { name: 'Salvar e publicar' })).toBeDisabled();
  await gestor.getByLabel('Quantidade de bolsas').first().fill('2');
  await expect(gestor.getByTestId('soma-cotas')).toContainText('distribuição completa');
  await gestor.getByRole('button', { name: 'Salvar e publicar' }).click();
  await expect(gestor).toHaveURL(/\/gestor\/editais$/);
  await expect(gestor.getByRole('link', { name: tituloEdital })).toBeVisible();

  // ── 2. Discente cria conta e se inscreve pelo formulário em etapas
  const discente = await (await browser.newContext()).newPage();
  await discente.goto('/cadastro');
  await discente.getByLabel('Nome completo').fill(`Discente E2E ${sufixo}`);
  await discente.getByLabel('E-mail').fill(`discente.${sufixo}@aluno.edu.br`);
  await discente.getByLabel('Departamento').fill('BIO');
  await discente.getByLabel('Matrícula').fill(`2024${sufixo}`);
  await discente.getByLabel('Senha', { exact: true }).fill('senha123');
  await discente.getByLabel('Confirmar senha').fill('senha123');
  await discente.getByRole('button', { name: 'Criar conta' }).click();
  await expect(discente).toHaveURL(/\/inicio/);

  await discente.goto('/editais');
  const card = discente.locator('div', { has: discente.getByRole('link', { name: tituloEdital }) }).last();
  await card.getByRole('link', { name: 'Inscrever-se' }).click();
  await expect(discente).toHaveURL(/\/inscricoes\/.+\/editar/);

  await discente.getByLabel('Título do projeto').fill(tituloProjeto);
  await discente.getByLabel('Subárea CNPq').selectOption({ index: 1 });
  await discente.getByLabel('Palavras-chave').fill('ecologia; séries temporais');
  await discente.getByRole('button', { name: 'Próximo' }).click();

  await discente.getByLabel('Resumo').fill(
    'Investigação de métodos estatísticos e de aprendizado de máquina para detectar padrões sazonais em séries ecológicas de longo prazo.',
  );
  await discente.getByLabel('Objetivos').fill('Comparar modelos de decomposição sazonal e detectar mudanças de regime.');
  await discente.getByLabel('Metodologia').fill('Coleta de bases públicas, pré-processamento, modelagem e validação temporal dos resultados.');
  await discente.getByRole('button', { name: 'Próximo' }).click();

  await discente.getByLabel('Orientador(a)').selectOption({ label: `${CONTAS.docente.nome} (DCC)` });
  await discente.getByRole('button', { name: 'Próximo' }).click();

  await discente.getByLabel('Plano de trabalho').setInputFiles(pdf('plano.pdf'));
  await expect(discente.getByText('plano.pdf')).toBeVisible();
  await discente.getByLabel('Currículo Lattes').setInputFiles(pdf('lattes.pdf'));
  await expect(discente.getByText('lattes.pdf')).toBeVisible();
  await discente.getByRole('button', { name: 'Próximo' }).click();

  await expect(discente.getByText('Tudo pronto para submeter')).toBeVisible();
  await discente.getByRole('button', { name: 'Submeter inscrição' }).click();
  await discente.getByRole('dialog').getByRole('button', { name: 'Submeter' }).click();
  await expect(discente).toHaveURL(/\/inscricoes\/[^/]+$/);
  await expect(discente.getByText('Aguardando o orientador')).toBeVisible();
  const inscricaoId = discente.url().split('/').pop() as string;

  // ── 3. Orientador confirma o vínculo
  const docente = await sessao(browser, CONTAS.docente);
  await docente.goto('/orientacoes');
  await docente.getByRole('link', { name: tituloProjeto }).first().click();
  await docente.getByRole('button', { name: 'Confirmar orientação' }).click();
  await expect(docente.getByText('Orientação confirmada').first()).toBeVisible();

  // ── 4. Gestor distribui ao avaliador (outro departamento)
  await gestor.goto(`/triagem/${inscricaoId}`);
  await gestor.getByRole('checkbox', { name: new RegExp(CONTAS.avaliador.nome) }).check();
  await gestor.getByRole('button', { name: /Atribuir/ }).click();
  await expect(gestor.getByText('Parecer pendente')).toBeVisible();

  // ── 5. Avaliador emite o parecer pela rubrica
  const avaliador = await sessao(browser, CONTAS.avaliador);
  await avaliador.goto('/avaliacoes');
  await avaliador.getByRole('link', { name: tituloProjeto }).click();
  for (const criterio of ['Mérito científico', 'Viabilidade do plano de trabalho', 'Adequação ao edital', 'Potencial de formação']) {
    await avaliador.getByRole('group', { name: criterio }).getByText('9', { exact: true }).click();
  }
  await expect(avaliador.getByText('9,0', { exact: true })).toBeVisible();
  await avaliador.getByRole('button', { name: 'Enviar parecer' }).click();
  await avaliador.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click();
  await expect(avaliador).toHaveURL(/\/avaliacoes$/);

  // ── 6. Gestor homologa
  await gestor.reload();
  await gestor.getByRole('button', { name: 'Aprovar e atribuir bolsa' }).click();
  await gestor.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();
  await expect(gestor.getByText(/Homologada em/)).toBeVisible();

  // ── 7. Discente é notificado e a pesquisa entra na vitrine pública
  await discente.goto('/notificacoes');
  await expect(discente.getByText('Proposta aprovada')).toBeVisible();

  const visitante = await (await browser.newContext()).newPage();
  await visitante.goto('/pesquisas');
  await expect(visitante.getByRole('heading', { name: tituloProjeto })).toBeVisible();
});

test('rotas protegidas: sem sessão vai ao login; papel errado vê acesso restrito', async ({ page }) => {
  await page.goto('/triagem');
  await expect(page).toHaveURL(/\/login/);

  await entrar(page, CONTAS.docente);
  // Após o login volta ao destino pedido, que não é do papel docente.
  await expect(page.getByText('Acesso restrito')).toBeVisible();
  await page.goto('/orientacoes');
  await expect(page.getByRole('heading', { name: 'Orientações' })).toBeVisible();
});
