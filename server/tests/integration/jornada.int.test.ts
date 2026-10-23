/**
 * Integração (HTTP, in-memory) — fluxo UNICAP completo com JWT real:
 *   gestão abre o edital → professor escreve e divulga o projeto → alunos se candidatam
 *   → professor seleciona o aluno e envia ao edital indicando três colegas
 *   → os três professores emitem parecer (RN07) → gestão homologa (cota)
 *   → aluno é notificado → relatório mensal até o dia 5, com lembrete e aviso de atraso
 *   → CSV mascarado (RN09) → vitrine pública (RN10).
 */
import request from 'supertest';

import type { AppContainer } from '../../src/infra/config/app.container';
import { buildTestApp } from '../helpers/app';
import { FixedClock } from '../../src/shared/testing/fixed-clock';
import { criarELogar } from '../helpers/usuarios';

jest.setTimeout(30000);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

type Auth = { Authorization: string };

let container: AppContainer;
let clock: FixedClock;
let gestor: Auth;
let discente: Auth;
let discenteId: string;
let colega: Auth;
let colegaId: string;
let docente: Auth;
let docenteId: string;
let profFis: Auth;
let profFisId: string;
let profQui: Auth;
let profQuiId: string;
let profDcc: Auth;
let profDccId: string;

const notasAltas = [
  { criterio: 'MERITO', nota: 9 },
  { criterio: 'VIABILIDADE', nota: 8 },
  { criterio: 'ADEQUACAO', nota: 9 },
  { criterio: 'FORMACAO', nota: 8 },
];

beforeEach(async () => {
  clock = new FixedClock('2026-09-14T12:00:00.000Z');
  container = buildTestApp({ clock, jwtSecret: 'jornada-secret' });

  gestor = (await criarELogar(container, { nome: 'Gestora', email: 'gestora@pibic.edu.br', role: 'GESTOR' })).auth;
  const aluno = await criarELogar(container, {
    nome: 'Lucas Discente',
    email: 'lucas@aluno.edu.br',
    role: 'DISCENTE',
    matricula: '2021049281',
  });
  discente = aluno.auth;
  discenteId = aluno.usuario.id;
  const outroAluno = await criarELogar(container, { nome: 'Maria Colega', email: 'maria@aluno.edu.br', role: 'DISCENTE' });
  colega = outroAluno.auth;
  colegaId = outroAluno.usuario.id;

  const professor = async (nome: string, email: string, departamento: string) =>
    criarELogar(container, { nome, email, role: 'DOCENTE', departamento });
  ({ auth: docente, usuario: { id: docenteId } } = await professor('Prof. Roberto', 'roberto@pibic.edu.br', 'DCC'));
  ({ auth: profFis, usuario: { id: profFisId } } = await professor('Profa. Física', 'fis@pibic.edu.br', 'FIS'));
  ({ auth: profQui, usuario: { id: profQuiId } } = await professor('Prof. Química', 'qui@pibic.edu.br', 'QUI'));
  // Mesmo departamento do orientador: pode avaliar (o conflito por departamento foi removido).
  ({ auth: profDcc, usuario: { id: profDccId } } = await professor('Profa. Colega DCC', 'dcc@pibic.edu.br', 'DCC'));
});

const avaliadores = () => [profFisId, profQuiId, profDccId];

async function editalPublicado(): Promise<string> {
  const created = await request(container.app)
    .post('/api/editais')
    .set(gestor)
    .send({
      numero: '06/2026',
      titulo: 'Edital PIBIC 2026/2027',
      tipoBolsa: 'PIBIC',
      totalCotas: 2,
      notaCorte: 7,
      cotas: [{ subareaCode: '1.03', quantidade: 1 }, { subareaCode: '1.01', quantidade: 1 }],
      dataInicioInscricoes: '2026-09-01T00:00:00.000Z',
      dataFimInscricoes: '2026-10-31T23:59:59.000Z',
    });
  expect(created.status).toBe(201);
  const published = await request(container.app)
    .post(`/api/editais/${created.body.id as string}/publicar`)
    .set(gestor);
  expect(published.status).toBe(200);
  return created.body.id as string;
}

/** Envio em três passos, como o navegador faz: autoriza, manda o PDF ao armazenamento e confirma. */
async function upload(path: string, auth: Auth, nome: string, content: Buffer = PDF) {
  const envio = await request(container.app).post(`${path}/envio`).set(auth);
  if (envio.status !== 200) return envio;
  // Nos testes o "armazenamento" é a rota local assinada, no lugar do Vercel Blob.
  const enviado = await request(container.app)
    .put(envio.body.upload.url as string)
    .set('Content-Type', 'application/pdf')
    .send(content);
  if (enviado.status !== 204) return enviado;
  return request(container.app).put(path).set(auth).send({ chave: envio.body.chave as string, nome });
}

/** Professor escreve o projeto e o divulga aos alunos. */
async function projetoDivulgado(editalId: string): Promise<string> {
  const criado = await request(container.app).post('/api/inscricoes').set(docente).send({ editalId });
  expect(criado.status).toBe(201);
  const id = criado.body.id as string;

  const salvo = await request(container.app)
    .patch(`/api/inscricoes/${id}`)
    .set(docente)
    .send({
      titulo: 'Aprendizado profundo para tomografia pulmonar',
      subareaCode: '1.03',
      palavrasChave: 'redes neurais; saúde',
      resumo: 'Este projeto investiga redes neurais convolucionais aplicadas à segmentação de tomografias pulmonares em bases públicas.',
      objetivos: 'Treinar e comparar arquiteturas U-Net e ResNet na segmentação de lesões.',
      metodologia: 'Revisão sistemática, preparação das bases, treino com validação cruzada e análise estatística.',
    });
  expect(salvo.status).toBe(200);
  // Faltam: divulgar, selecionar o aluno e os dois PDFs.
  expect(salvo.body.pendencias).toHaveLength(4);

  const divulgado = await request(container.app).post(`/api/inscricoes/${id}/divulgacao`).set(docente);
  expect(divulgado.status).toBe(200);
  expect(divulgado.body.status).toBe('DIVULGADA');
  return id;
}

function candidatar(auth: Auth, id: string) {
  return request(container.app)
    .post(`/api/inscricoes/${id}/candidaturas`)
    .set(auth)
    .send({ mensagem: 'Tenho interesse na área e disponibilidade de 20 horas semanais para o projeto.' });
}

/** Divulgado, com o aluno selecionado e os anexos: pronto para o envio. */
async function projetoPronto(editalId: string): Promise<string> {
  const id = await projetoDivulgado(editalId);
  const candidatura = await candidatar(discente, id);
  expect(candidatura.status).toBe(201);

  const selecao = await request(container.app)
    .post(`/api/inscricoes/${id}/selecao`)
    .set(docente)
    .send({ candidaturaId: candidatura.body.id });
  expect(selecao.status).toBe(200);
  expect(selecao.body.discente.id).toBe(discenteId);

  expect((await upload(`/api/inscricoes/${id}/anexos/PLANO_TRABALHO`, docente, 'plano.pdf')).status).toBe(200);
  const comLattes = await upload(`/api/inscricoes/${id}/anexos/LATTES`, docente, 'lattes.pdf');
  expect(comLattes.body.pendencias).toEqual([]);
  return id;
}

function enviar(id: string, avaliadorIds: string[] = avaliadores()) {
  return request(container.app).post(`/api/inscricoes/${id}/submissao`).set(docente).send({ avaliadorIds });
}

async function tiposDeNotificacao(auth: Auth): Promise<string[]> {
  const res = await request(container.app).get('/api/notificacoes').set(auth);
  return res.body.data.map((n: { tipo: string }) => n.tipo);
}

async function emitirParecer(auth: Auth, notas = notasAltas, parecer = '') {
  const minhas = await request(container.app).get('/api/avaliacoes/minhas').set(auth);
  const pendente = minhas.body.data.find((a: { status: string }) => a.status === 'PENDENTE');
  return request(container.app).post(`/api/avaliacoes/${pendente.id as string}/parecer`).set(auth).send({ notas, parecer });
}

async function projetoAprovado(): Promise<string> {
  const editalId = await editalPublicado();
  const id = await projetoPronto(editalId);
  expect((await enviar(id)).status).toBe(200);
  for (const prof of [profFis, profQui, profDcc]) {
    expect((await emitirParecer(prof)).status).toBe(200);
  }
  const aprovada = await request(container.app).post(`/api/triagem/${id}/homologacao`).set(gestor).send({ decisao: 'APROVAR' });
  expect(aprovada.body.inscricao.status).toBe('APROVADA');
  return id;
}

describe('Projeto de pesquisa: divulgação, candidatura, seleção e envio', () => {
  it('professor divulga, alunos se candidatam, professor seleciona e envia ao edital com três avaliadores', async () => {
    const editalId = await editalPublicado();
    const id = await projetoDivulgado(editalId);
    expect(await tiposDeNotificacao(discente)).toContain('PROJETO_DIVULGADO');

    // O projeto aparece aos alunos (inclusive sem login), sem dados sensíveis.
    const vitrine = await request(container.app).get('/api/publico/projetos');
    expect(vitrine.body.total).toBe(1);
    expect(vitrine.body.data[0]).toMatchObject({ id, orientador: { nome: 'Prof. Roberto', departamento: 'DCC' } });
    expect(JSON.stringify(vitrine.body)).not.toMatch(/@|storageKey/);

    const minha = await candidatar(discente, id);
    expect(minha.status).toBe(201);
    expect((await candidatar(colega, id)).status).toBe(201);
    expect(await tiposDeNotificacao(docente)).toContain('CANDIDATURA_RECEBIDA');

    const candidatos = await request(container.app).get(`/api/inscricoes/${id}/candidaturas`).set(docente);
    expect(candidatos.body.total).toBe(2);
    expect(candidatos.body.data[0].discente).toMatchObject({ nome: 'Lucas Discente', matricula: '2021049281' });

    await request(container.app).post(`/api/inscricoes/${id}/selecao`).set(docente).send({ candidaturaId: minha.body.id });
    expect(await tiposDeNotificacao(discente)).toContain('CANDIDATURA_RESULTADO');
    await upload(`/api/inscricoes/${id}/anexos/PLANO_TRABALHO`, docente, 'plano.pdf');
    await upload(`/api/inscricoes/${id}/anexos/LATTES`, docente, 'lattes.pdf');

    const enviado = await enviar(id);
    expect(enviado.status).toBe(200);
    expect(enviado.body.status).toBe('EM_AVALIACAO');
    expect(enviado.body.protocolo).toMatch(/^23076\.000001\/2026-\d{2}$/);

    // RN05: depois do envio, nada muda no projeto.
    const edicao = await request(container.app).patch(`/api/inscricoes/${id}`).set(docente).send({ titulo: 'Outro título qualquer' });
    expect(edicao.status).toBe(422);

    // Aluno selecionado é avisado do envio; a colega, de que não foi escolhida.
    expect(await tiposDeNotificacao(discente)).toContain('PROJETO_ENVIADO');
    const daColega = await request(container.app).get('/api/candidaturas/minhas').set(colega);
    expect(daColega.body.data[0]).toMatchObject({ status: 'NAO_SELECIONADA', projeto: { id } });

    // Os três professores indicados recebem o projeto para avaliar.
    for (const prof of [profFis, profQui, profDcc]) {
      expect(await tiposDeNotificacao(prof)).toContain('AVALIACAO_ATRIBUIDA');
    }
    expect((await request(container.app).get('/api/publico/projetos')).body.total).toBe(0);
  });

  it('só o professor cria e edita projetos; aluno só se candidata a projeto divulgado', async () => {
    const editalId = await editalPublicado();
    expect((await request(container.app).post('/api/inscricoes').set(discente).send({ editalId })).status).toBe(403);

    const rascunho = await request(container.app).post('/api/inscricoes').set(docente).send({ editalId });
    const naoDivulgado = await candidatar(discente, rascunho.body.id as string);
    expect(naoDivulgado.status).toBe(422);
    expect(naoDivulgado.body.error.message).toMatch(/ainda não foi divulgado/);

    const id = await projetoDivulgado(editalId);
    expect((await candidatar(docente, id)).status).toBe(403);
    const curta = await request(container.app).post(`/api/inscricoes/${id}/candidaturas`).set(discente).send({ mensagem: 'quero' });
    expect(curta.status).toBe(400);
    expect((await candidatar(discente, id)).status).toBe(201);
    expect((await candidatar(discente, id)).status).toBe(409);

    // Outro professor não vê os candidatos.
    expect((await request(container.app).get(`/api/inscricoes/${id}/candidaturas`).set(profFis)).status).toBe(404);
  });

  it('aluno desiste da candidatura enquanto o professor não decidiu', async () => {
    const editalId = await editalPublicado();
    const id = await projetoDivulgado(editalId);
    const candidatura = await candidatar(discente, id);
    const desistencia = await request(container.app).delete(`/api/candidaturas/${candidatura.body.id as string}`).set(discente);
    expect(desistencia.status).toBe(204);
    expect((await request(container.app).get('/api/candidaturas/minhas').set(discente)).body.total).toBe(0);
  });

  it('um aluno é selecionado para um só projeto por edital (409)', async () => {
    const editalId = await editalPublicado();
    const primeiro = await projetoDivulgado(editalId);
    const segundo = await projetoDivulgado(editalId);
    const c1 = await candidatar(discente, primeiro);
    const c2 = await candidatar(discente, segundo);
    await request(container.app).post(`/api/inscricoes/${primeiro}/selecao`).set(docente).send({ candidaturaId: c1.body.id });

    const dupla = await request(container.app).post(`/api/inscricoes/${segundo}/selecao`).set(docente).send({ candidaturaId: c2.body.id });
    expect(dupla.status).toBe(409);
    expect(dupla.body.error.message).toMatch(/outro projeto/);
  });

  it('envio exige três professores avaliadores, sem o próprio orientador', async () => {
    const editalId = await editalPublicado();
    const id = await projetoPronto(editalId);

    const dois = await enviar(id, [profFisId, profQuiId]);
    expect(dois.status).toBe(400);
    expect(dois.body.error.message).toMatch(/exatamente 3/);

    const comOProprio = await enviar(id, [profFisId, profQuiId, docenteId]);
    expect(comOProprio.status).toBe(422);
    expect(comOProprio.body.error.message).toMatch(/próprio projeto/);

    const comAluno = await enviar(id, [profFisId, profQuiId, colegaId]);
    expect(comAluno.status).toBe(400);
    expect(comAluno.body.error.message).toMatch(/professores cadastrados/);

    // Nada foi gravado nas tentativas inválidas.
    const detalhe = await request(container.app).get(`/api/inscricoes/${id}`).set(docente);
    expect(detalhe.body.status).toBe('DIVULGADA');
    expect((await enviar(id)).status).toBe(200);
  });

  it('impede o envio com pendências e lista o que falta (422)', async () => {
    const editalId = await editalPublicado();
    const id = await projetoDivulgado(editalId);
    const res = await enviar(id);
    expect(res.status).toBe(422);
    expect(res.body.error.details.pendencias.join(' ')).toMatch(/Selecione o aluno/);
  });

  it('RN06: rejeita arquivo que não é PDF, mesmo com Content-Type de PDF', async () => {
    const editalId = await editalPublicado();
    const criado = await request(container.app).post('/api/inscricoes').set(docente).send({ editalId });
    const res = await upload(`/api/inscricoes/${criado.body.id as string}/anexos/LATTES`, docente, 'virus.pdf', Buffer.from('MZ executável'));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/PDF/);
  });

  it('só confirma um PDF enviado com a chave emitida para aquela inscrição e tipo de anexo', async () => {
    const editalId = await editalPublicado();
    const criado = await request(container.app).post('/api/inscricoes').set(docente).send({ editalId });
    const id = criado.body.id as string;
    const envio = await request(container.app).post(`/api/inscricoes/${id}/anexos/LATTES/envio`).set(docente);
    await request(container.app).put(envio.body.upload.url as string).set('Content-Type', 'application/pdf').send(PDF);

    // A chave foi emitida para o Lattes: não serve para registrar o plano de trabalho.
    const trocado = await request(container.app)
      .put(`/api/inscricoes/${id}/anexos/PLANO_TRABALHO`)
      .set(docente)
      .send({ chave: envio.body.chave as string, nome: 'plano.pdf' });
    expect(trocado.status).toBe(400);

    // Confirmar sem ter enviado o arquivo também é recusado.
    const semArquivo = await request(container.app).post(`/api/inscricoes/${id}/anexos/PLANO_TRABALHO/envio`).set(docente);
    const vazio = await request(container.app)
      .put(`/api/inscricoes/${id}/anexos/PLANO_TRABALHO`)
      .set(docente)
      .send({ chave: semArquivo.body.chave as string, nome: 'plano.pdf' });
    expect(vazio.status).toBe(400);
    expect(vazio.body.error.message).toMatch(/não chegou/);
  });

  it('candidato não selecionado e professores não indicados não veem o projeto (404)', async () => {
    const editalId = await editalPublicado();
    const id = await projetoPronto(editalId);
    await candidatar(colega, id);
    await enviar(id, [profFisId, profQuiId, profDccId]);

    expect((await request(container.app).get(`/api/inscricoes/${id}`).set(colega)).status).toBe(404);
    expect((await request(container.app).get(`/api/inscricoes/${id}`).set(discente)).status).toBe(200);
    expect((await request(container.app).get(`/api/inscricoes/${id}`).set(profFis)).status).toBe(200);
  });
});

describe('Avaliação pelos três professores e homologação', () => {
  it('fluxo completo até a aprovação, com RN07 e consolidação', async () => {
    const editalId = await editalPublicado();
    const id = await projetoPronto(editalId);
    await enviar(id);

    // O professor avaliador vê o projeto e o PDF.
    const minhas = await request(container.app).get('/api/avaliacoes/minhas').set(profFis);
    expect(minhas.body.total).toBe(1);
    const anexoId = minhas.body.data[0].inscricao.anexos[0].id as string;
    const link = await request(container.app).get(`/api/inscricoes/${id}/anexos/${anexoId}/arquivo`).set(profFis);
    expect(link.status).toBe(200);
    expect(link.body.nome).toBe('plano.pdf');
    const pdf = await request(container.app).get(link.body.url as string);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');

    // RN07: nota abaixo do corte (7) exige parecer.
    const notasBaixas = notasAltas.map((n) => ({ ...n, nota: 5 }));
    const semParecer = await emitirParecer(profFis, notasBaixas, '');
    expect(semParecer.status).toBe(400);
    expect(semParecer.body.error.message).toMatch(/RN07/);

    expect((await emitirParecer(profFis)).body.notaFinal).toBe(8.5);
    await emitirParecer(profQui, notasAltas.map((n) => ({ ...n, nota: 7 })), 'Bom projeto.');

    // Com dois de três pareceres o projeto continua em avaliação.
    expect((await request(container.app).get(`/api/triagem/${id}`).set(gestor)).body.inscricao.status).toBe('EM_AVALIACAO');
    await emitirParecer(profDcc);

    const item = await request(container.app).get(`/api/triagem/${id}`).set(gestor);
    expect(item.body.inscricao.status).toBe('AVALIADA');
    expect(item.body.consolidado).toMatchObject({ concluidas: 3, media: 8, divergente: false });

    const ranking = await request(container.app).get(`/api/triagem/editais/${editalId}/ranking`).set(gestor);
    expect(ranking.body.data[0].inscricao.id).toBe(id);

    const aprovada = await request(container.app).post(`/api/triagem/${id}/homologacao`).set(gestor).send({ decisao: 'APROVAR' });
    expect(aprovada.status).toBe(200);
    expect(aprovada.body.inscricao.status).toBe('APROVADA');

    // RF18: o aluno recebe o status da aprovação.
    const notifs = await request(container.app).get('/api/notificacoes').set(discente);
    const resultado = notifs.body.data.find((n: { tipo: string }) => n.tipo === 'INSCRICAO_RESULTADO');
    expect(resultado.titulo).toBe('Projeto aprovado');

    const painel = await request(container.app).get('/api/dashboard/gestor').set(gestor);
    expect(painel.body.bolsas).toEqual({ total: 2, alocadas: 1 });
    expect(painel.body.avaliacoes.concluidas).toBe(3);

    // Vitrine pública: só aprovadas e sem dados sensíveis (RN10).
    const vitrine = await request(container.app).get('/api/publico/pesquisas');
    expect(vitrine.body.total).toBe(1);
    expect(vitrine.body.data[0]).toMatchObject({ bolsista: 'Lucas Discente', orientador: { nome: 'Prof. Roberto', departamento: 'DCC' } });
    expect(JSON.stringify(vitrine.body)).not.toMatch(/@|2021049281|storageKey/);
    expect((await request(container.app).get('/api/publico/editais')).body.data[0].bolsasAlocadas).toBe(1);
  });

  it('gestão substitui um avaliador que não respondeu', async () => {
    const editalId = await editalPublicado();
    const id = await projetoPronto(editalId);
    await enviar(id);
    const substituto = await criarELogar(container, { nome: 'Prof. Substituto', email: 'sub@pibic.edu.br', role: 'DOCENTE' });

    const item = await request(container.app).get(`/api/triagem/${id}`).set(gestor);
    const pendente = item.body.avaliacoes.find((a: { avaliador: { id: string } }) => a.avaliador.id === profQuiId);
    expect((await request(container.app).delete(`/api/triagem/avaliacoes/${pendente.id as string}`).set(gestor)).status).toBe(204);

    const cheio = await request(container.app).post(`/api/triagem/${id}/avaliadores`).set(gestor).send({ avaliadorIds: [substituto.usuario.id, profQuiId] });
    expect(cheio.status).toBe(422);

    const trocado = await request(container.app).post(`/api/triagem/${id}/avaliadores`).set(gestor).send({ avaliadorIds: [substituto.usuario.id] });
    expect(trocado.status).toBe(201);
    expect(trocado.body.avaliacoes).toHaveLength(3);
    expect(trocado.body.inscricao.status).toBe('EM_AVALIACAO');
  });

  it('aluno é avisado quando o projeto não é aprovado', async () => {
    const editalId = await editalPublicado();
    const id = await projetoPronto(editalId);
    await enviar(id);
    for (const prof of [profFis, profQui, profDcc]) await emitirParecer(prof);

    const curta = await request(container.app).post(`/api/triagem/${id}/homologacao`).set(gestor).send({ decisao: 'RECUSAR', justificativa: 'não' });
    expect(curta.status).toBe(400);
    await request(container.app)
      .post(`/api/triagem/${id}/homologacao`)
      .set(gestor)
      .send({ decisao: 'RECUSAR', justificativa: 'Cotas da subárea preenchidas por projetos com média maior.' });

    const notifs = await request(container.app).get('/api/notificacoes').set(discente);
    expect(notifs.body.data.find((n: { tipo: string }) => n.tipo === 'INSCRICAO_RESULTADO').titulo).toBe('Projeto não aprovado');
  });

  it('não aprova além da cota da subárea', async () => {
    const editalId = await editalPublicado();
    const id = await projetoPronto(editalId);
    await enviar(id);
    for (const prof of [profFis, profQui, profDcc]) await emitirParecer(prof);

    // Ocupa a única cota de 1.03 com outro projeto aprovado.
    const ocupante = await container.inscricoesRepository.findById(id);
    await container.inscricoesRepository.create({ ...ocupante!, id: 'outra', discenteId: 'x', protocolo: 'p', status: 'APROVADA' });

    const res = await request(container.app).post(`/api/triagem/${id}/homologacao`).set(gestor).send({ decisao: 'APROVAR' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Cota esgotada/);
  });
});

describe('Relatórios mensais (todo dia 5) e final', () => {
  const textoDoMes = 'Revisão bibliográfica sobre U-Net, preparação da base pública e primeiros treinos com validação cruzada.';

  function relatorio(id: string, body: Record<string, unknown>) {
    return request(container.app).post(`/api/projetos/${id}/relatorios`).set(discente).send(body);
  }

  it('bolsista relata o mês, anexa PDF opcional; orientador devolve e aprova; CSV mascara a matrícula', async () => {
    const id = await projetoAprovado();
    expect((await request(container.app).get('/api/projetos').set(discente)).body.total).toBe(1);

    const futuro = await relatorio(id, { tipo: 'MENSAL', competencia: '2026-10', descricao: textoDoMes });
    expect(futuro.status).toBe(422);
    const semTexto = await relatorio(id, { tipo: 'MENSAL', competencia: '2026-09', descricao: 'pouco' });
    expect(semTexto.status).toBe(400);

    const v1 = await relatorio(id, { tipo: 'MENSAL', competencia: '2026-09', descricao: textoDoMes });
    expect(v1.status).toBe(201);
    expect(v1.body).toMatchObject({ versao: 1, status: 'ENVIADO', arquivo: null });
    expect(await tiposDeNotificacao(docente)).toContain('RELATORIO_ENVIADO');

    const comPdf = await upload(`/api/projetos/${id}/relatorios/${v1.body.id as string}/arquivo`, discente, 'setembro.pdf');
    expect(comPdf.body.arquivo).toMatchObject({ nome: 'setembro.pdf' });

    const devolvido = await request(container.app)
      .post(`/api/projetos/${id}/relatorios/${v1.body.id as string}/avaliacao`)
      .set(docente)
      .send({ decisao: 'DEVOLVER', comentario: 'Inclua os resultados preliminares.' });
    expect(devolvido.body.status).toBe('DEVOLVIDO');

    const v2 = await relatorio(id, { tipo: 'MENSAL', competencia: '2026-09', descricao: `${textoDoMes} Resultados: Dice de 0,81.` });
    expect(v2.body.versao).toBe(2);
    await request(container.app).post(`/api/projetos/${id}/relatorios/${v2.body.id as string}/avaliacao`).set(docente).send({ decisao: 'APROVAR' });

    const detalhe = await request(container.app).get(`/api/projetos/${id}`).set(docente);
    expect(detalhe.body.relatorios).toHaveLength(2);
    expect(detalhe.body.acompanhamento[0]).toMatchObject({ tipo: 'MENSAL', competencia: '2026-09', situacao: 'APROVADO' });
    expect(detalhe.body.acompanhamento.at(-1)).toMatchObject({ tipo: 'FINAL', competencia: null });

    const csv = await request(container.app).get('/api/projetos/exportacao.csv').set(gestor);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('*******281');
    expect(csv.text).not.toContain('2021049281');
    expect((await request(container.app).get('/api/projetos/exportacao.csv').set(discente)).status).toBe(403);
  });

  it('relatório final só é aprovado com o PDF', async () => {
    const id = await projetoAprovado();
    const final = await relatorio(id, { tipo: 'FINAL', descricao: '' });
    expect(final.status).toBe(201);
    const aprovar = () =>
      request(container.app).post(`/api/projetos/${id}/relatorios/${final.body.id as string}/avaliacao`).set(docente).send({ decisao: 'APROVAR' });

    expect((await aprovar()).status).toBe(422);
    await upload(`/api/projetos/${id}/relatorios/${final.body.id as string}/arquivo`, discente, 'final.pdf');
    expect((await aprovar()).body.status).toBe('APROVADO');
  });

  it('lembra o bolsista antes do dia 5 e avisa o atraso a bolsista e orientador, uma vez só', async () => {
    const id = await projetoAprovado();

    clock.setTo('2026-10-02T12:00:00.000Z');
    expect(await container.projetosService.enviarLembretes()).toBe(1);
    expect(await container.projetosService.enviarLembretes()).toBe(0);
    expect(await tiposDeNotificacao(discente)).toContain('RELATORIO_LEMBRETE');

    clock.setTo('2026-10-07T12:00:00.000Z');
    expect(await container.projetosService.enviarLembretes()).toBe(2);
    expect(await tiposDeNotificacao(discente)).toContain('RELATORIO_ATRASADO');
    expect(await tiposDeNotificacao(docente)).toContain('RELATORIO_ATRASADO');

    const detalhe = await request(container.app).get(`/api/projetos/${id}`).set(discente);
    expect(detalhe.body.acompanhamento[0]).toMatchObject({ competencia: '2026-09', situacao: 'ATRASADO' });

    // Relatar o mês atrasado ainda é permitido.
    expect((await relatorio(id, { tipo: 'MENSAL', competencia: '2026-09', descricao: textoDoMes })).status).toBe(201);
  });
});
