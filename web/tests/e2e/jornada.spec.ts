import { expect, test } from '@playwright/test';

import { CONTAS, dataInput, entrar, linkDoEmail, pdf, sessao } from './support';

/**
 * E2E (browser) — fluxo UNICAP completo sobre o servidor real (API + SPA +
 * Firestore com seed). Cria o próprio edital, projeto e conta de aluno, então
 * pode rodar várias vezes seguidas.
 */
test('ciclo completo: edital, divulgação, candidatura, seleção, três pareceres, homologação e relatório mensal', async ({ browser }) => {
  test.setTimeout(180_000);
  const sufixo = Date.now().toString().slice(-6);
  const tituloEdital = `Edital E2E ${sufixo}`;
  const tituloProjeto = `Detecção de padrões em séries ecológicas ${sufixo}`;
  const nomeAluno = `Discente E2E ${sufixo}`;

  // ── 1. A gestão (UNICAP) abre o edital, com validação em tempo real das cotas
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

  // ── 2. O professor escreve o projeto no edital e o divulga aos alunos
  const docente = await sessao(browser, CONTAS.docente);
  await docente.goto('/inscricoes/nova');
  const editalCard = docente.locator('div', { has: docente.getByRole('link', { name: tituloEdital }) }).last();
  await editalCard.getByRole('link', { name: 'Escrever projeto neste edital' }).click();
  await expect(docente).toHaveURL(/\/inscricoes\/.+\/editar/);
  const projetoId = docente.url().split('/').at(-2) as string;

  await docente.getByLabel('Título do projeto').fill(tituloProjeto);
  await docente.getByLabel('Subárea CNPq').selectOption({ index: 1 });
  await docente.getByLabel('Palavras-chave').fill('ecologia; séries temporais');
  await docente.getByRole('button', { name: 'Próximo' }).click();
  await docente.getByLabel('Resumo').fill(
    'Investigação de métodos estatísticos e de aprendizado de máquina para detectar padrões sazonais em séries ecológicas de longo prazo.',
  );
  await docente.getByLabel('Objetivos').fill('Comparar modelos de decomposição sazonal e detectar mudanças de regime.');
  await docente.getByLabel('Metodologia').fill('Coleta de bases públicas, pré-processamento, modelagem e validação temporal dos resultados.');
  await docente.getByRole('button', { name: 'Próximo' }).click();
  await docente.getByLabel('Plano de trabalho').setInputFiles(pdf('plano.pdf'));
  await expect(docente.getByText('plano.pdf')).toBeVisible();
  await docente.getByRole('button', { name: 'Próximo' }).click();
  await expect(docente.getByText('Pronto para divulgar')).toBeVisible();
  await docente.getByRole('button', { name: 'Divulgar aos alunos' }).click();
  await docente.getByRole('dialog').getByRole('button', { name: 'Divulgar' }).click();
  await expect(docente).toHaveURL(new RegExp(`/inscricoes/${projetoId}$`));
  await expect(docente.getByText('Recebendo candidaturas')).toBeVisible();

  // ── 3. O aluno cria a conta com o e-mail @unicap.br e o Lattes, confirma o e-mail e se candidata
  const emailAluno = `discente.${sufixo}@unicap.br`;
  const discente = await (await browser.newContext()).newPage();
  await discente.goto('/cadastro');
  await discente.getByLabel('Nome completo').fill(nomeAluno);
  await discente.getByLabel('E-mail').fill(`discente.${sufixo}@gmail.com`);
  await discente.getByLabel('Departamento').fill('BIO');
  await discente.getByLabel('Matrícula').fill(`2024${sufixo}`);
  await discente.getByLabel('Currículo Lattes (PDF)').setInputFiles(pdf('lattes.pdf'));
  await discente.getByLabel('Senha', { exact: true }).fill('senha123');
  await discente.getByLabel('Confirmar senha').fill('senha123');
  await discente.getByRole('button', { name: 'Criar conta' }).click();
  // A mensagem de erro do campo (o subtítulo da página também cita o domínio, por isso o texto exato).
  await expect(discente.getByText('Use seu e-mail institucional @unicap.br.', { exact: true })).toBeVisible();
  await discente.getByLabel('E-mail').fill(emailAluno);
  await discente.getByRole('button', { name: 'Criar conta' }).click();
  await expect(discente.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible();

  // Antes de confirmar, a conta não entra.
  await discente.goto('/login');
  await discente.getByLabel('E-mail').fill(emailAluno);
  await discente.getByLabel('Senha').fill('senha123');
  await discente.getByRole('button', { name: 'Entrar' }).click();
  await expect(discente.getByText('Confirme seu e-mail para entrar')).toBeVisible();

  await discente.goto(await linkDoEmail(discente, emailAluno));
  await expect(discente).toHaveURL(/\/inicio/);

  await discente.goto('/oportunidades');
  const projetoCard = discente.locator('li', { has: discente.getByRole('heading', { name: tituloProjeto }) });
  await projetoCard.getByRole('button', { name: 'Ver e candidatar-se' }).click();
  await discente.getByLabel('Apresente-se ao professor').fill('Estudo ecologia quantitativa e tenho 20 horas semanais para o projeto.');
  await discente.getByRole('button', { name: 'Enviar candidatura' }).click();
  await expect(projetoCard.getByText('Em análise pelo professor')).toBeVisible();

  // ── 4. O professor vê o Lattes do candidato, seleciona o aluno e envia ao edital com três avaliadores
  //       (o Lattes do perfil do aluno entra no projeto sozinho no envio)
  await docente.reload();
  const candidato = docente.locator('li', { hasText: nomeAluno });
  await expect(candidato.getByRole('button', { name: 'Ver currículo' })).toBeVisible();
  await candidato.getByRole('button', { name: 'Selecionar' }).click();
  await expect(docente.getByText(`Você selecionou ${nomeAluno}`)).toBeVisible();

  for (const prof of CONTAS.avaliadores) {
    await docente.getByRole('checkbox', { name: new RegExp(prof.nome) }).check();
  }
  await docente.getByRole('button', { name: 'Enviar ao edital' }).click();
  await docente.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click();
  await expect(docente.getByText('Três professores indicados estão avaliando')).toBeVisible();

  // ── 5. Os três professores indicados emitem o parecer pela rubrica
  for (const prof of CONTAS.avaliadores) {
    const avaliador = await sessao(browser, prof);
    await avaliador.goto('/avaliacoes');
    await avaliador.getByRole('link', { name: tituloProjeto }).click();
    for (const criterio of ['Mérito científico', 'Viabilidade do plano de trabalho', 'Adequação ao edital', 'Potencial de formação']) {
      await avaliador.getByRole('group', { name: criterio }).getByText('9', { exact: true }).click();
    }
    await expect(avaliador.getByText('9,0', { exact: true })).toBeVisible();
    await avaliador.getByRole('button', { name: 'Enviar parecer' }).click();
    await avaliador.getByRole('dialog').getByRole('button', { name: 'Enviar' }).click();
    await expect(avaliador).toHaveURL(/\/avaliacoes$/);
    await avaliador.context().close();
  }

  // ── 6. A gestão homologa
  await gestor.goto(`/triagem/${projetoId}`);
  await gestor.getByRole('button', { name: 'Aprovar e atribuir bolsa' }).click();
  await gestor.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();
  await expect(gestor.getByText(/Homologada em/)).toBeVisible();

  // ── 7. O aluno é notificado e envia o relatório do mês
  await discente.goto('/notificacoes');
  await expect(discente.getByText('Projeto aprovado')).toBeVisible();
  await discente.goto(`/projetos/${projetoId}`);
  await discente
    .getByLabel(/O que você fez em/)
    .fill('Levantamento das bases públicas de séries ecológicas e primeiros testes de decomposição sazonal com STL.');
  await discente.getByRole('button', { name: 'Enviar relatório', exact: true }).click();
  await expect(discente.getByText(/Relatório de .+, versão 1/)).toBeVisible();

  // ── 8. A pesquisa aprovada entra na vitrine pública
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
  await page.goto('/inscricoes');
  await expect(page.getByRole('heading', { name: 'Meus projetos de pesquisa' })).toBeVisible();
});

test('endereço inexistente: visitante vê o 404 público, sem violações de CSP', async ({ page }) => {
  const violacoes: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violacoes.push(msg.text());
  });

  await page.goto('/pagina-que-nao-existe');
  await expect(page).toHaveURL(/\/pagina-que-nao-existe$/);
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();

  await page.goto('/oportunidades');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.goto('/pesquisas');
  await expect(page.getByRole('heading').first()).toBeVisible();
  expect(violacoes).toEqual([]);
});
