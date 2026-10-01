/**
 * Integração (HTTP, in-memory) — ciclo completo S3 a S6 com JWT real:
 *   discente cria rascunho → anexa PDFs → submete (protocolo) → orientador confirma
 *   → gestor distribui (com checagem de conflito) → avaliadores emitem parecer (RN07)
 *   → gestor homologa (cota) → bolsista envia relatório → orientador devolve/aprova
 *   → CSV mascarado (RN09) → vitrine pública (RN10).
 */
import request from 'supertest';

import { buildApp, type AppContainer } from '../../src/infra/config/app.container';
import { FixedClock } from '../../src/shared/testing/fixed-clock';
import { criarELogar } from '../helpers/usuarios';

jest.setTimeout(30000);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

type Auth = { Authorization: string };

let container: AppContainer;
let clock: FixedClock;
let gestor: Auth;
let discente: Auth;
let docente: Auth;
let docenteId: string;
let avaliadorFis: Auth;
let avaliadorFisId: string;
let avaliadorQui: Auth;
let avaliadorQuiId: string;
let avaliadorDccId: string;

beforeEach(async () => {
  clock = new FixedClock('2026-09-14T12:00:00.000Z');
  container = buildApp({ clock, jwtSecret: 'jornada-secret' });

  gestor = (await criarELogar(container, { nome: 'Gestora', email: 'gestora@pibic.edu.br', role: 'GESTOR' })).auth;
  discente = (
    await criarELogar(container, {
      nome: 'Lucas Discente',
      email: 'lucas@aluno.edu.br',
      role: 'DISCENTE',
      matricula: '2021049281',
    })
  ).auth;
  const doc = await criarELogar(container, {
    nome: 'Prof. Roberto',
    email: 'roberto@pibic.edu.br',
    role: 'DOCENTE',
    departamento: 'DCC',
  });
  docente = doc.auth;
  docenteId = doc.usuario.id;
  const fis = await criarELogar(container, {
    nome: 'Dra. Física',
    email: 'fis@pibic.edu.br',
    role: 'AVALIADOR',
    departamento: 'FIS',
  });
  avaliadorFis = fis.auth;
  avaliadorFisId = fis.usuario.id;
  const qui = await criarELogar(container, {
    nome: 'Dr. Química',
    email: 'qui@pibic.edu.br',
    role: 'AVALIADOR',
    departamento: 'QUI',
  });
  avaliadorQui = qui.auth;
  avaliadorQuiId = qui.usuario.id;
  avaliadorDccId = (
    await criarELogar(container, {
      nome: 'Dr. Mesmo Depto',
      email: 'dcc@pibic.edu.br',
      role: 'AVALIADOR',
      departamento: 'DCC',
    })
  ).usuario.id;
});

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

function upload(path: string, auth: Auth, nome: string, content: Buffer = PDF) {
  return request(container.app)
    .put(path)
    .set(auth)
    .set('Content-Type', 'application/pdf')
    .set('X-Filename', encodeURIComponent(nome))
    .send(content);
}

async function inscricaoSubmetida(editalId: string): Promise<string> {
  const criada = await request(container.app).post('/api/inscricoes').set(discente).send({ editalId });
  expect(criada.status).toBe(201);
  const id = criada.body.id as string;

  const salvo = await request(container.app)
    .patch(`/api/inscricoes/${id}`)
    .set(discente)
    .send({
      titulo: 'Aprendizado profundo para tomografia pulmonar',
      subareaCode: '1.03',
      palavrasChave: 'redes neurais; saúde',
      resumo: 'Este projeto investiga redes neurais convolucionais aplicadas à segmentação de tomografias pulmonares em bases públicas.',
      objetivos: 'Treinar e comparar arquiteturas U-Net e ResNet na segmentação de lesões.',
      metodologia: 'Revisão sistemática, preparação das bases, treino com validação cruzada e análise estatística.',
      orientadorId: docenteId,
    });
  expect(salvo.status).toBe(200);
  expect(salvo.body.pendencias).toHaveLength(2); // faltam os dois PDFs

  expect((await upload(`/api/inscricoes/${id}/anexos/PLANO_TRABALHO`, discente, 'plano.pdf')).status).toBe(200);
  const comLattes = await upload(`/api/inscricoes/${id}/anexos/LATTES`, discente, 'lattes.pdf');
  expect(comLattes.body.pendencias).toEqual([]);

  const submetida = await request(container.app).post(`/api/inscricoes/${id}/submissao`).set(discente);
  expect(submetida.status).toBe(200);
  return id;
}

describe('Inscrição (S3)', () => {
  it('submete com protocolo, fica somente-leitura (RN05) e notifica o orientador', async () => {
    const editalId = await editalPublicado();
    const id = await inscricaoSubmetida(editalId);

    const detalhe = await request(container.app).get(`/api/inscricoes/${id}`).set(discente);
    expect(detalhe.body.status).toBe('SUBMETIDA');
    expect(detalhe.body.vinculoStatus).toBe('PENDENTE');
    expect(detalhe.body.protocolo).toMatch(/^23076\.000001\/2026-\d{2}$/);
    expect(detalhe.body.anexos).toHaveLength(2);
    expect(JSON.stringify(detalhe.body)).not.toContain('storageKey');

    const edicao = await request(container.app).patch(`/api/inscricoes/${id}`).set(discente).send({ titulo: 'Outro título qualquer' });
    expect(edicao.status).toBe(422);

    const notifs = await request(container.app).get('/api/notificacoes').set(docente);
    expect(notifs.body.data.map((n: { tipo: string }) => n.tipo)).toContain('VINCULO_SOLICITADO');
  });

  it('impede submeter com pendências e listar as pendências (422)', async () => {
    const editalId = await editalPublicado();
    const criada = await request(container.app).post('/api/inscricoes').set(discente).send({ editalId });
    const res = await request(container.app).post(`/api/inscricoes/${criada.body.id as string}/submissao`).set(discente);
    expect(res.status).toBe(422);
    expect(res.body.error.details.pendencias.length).toBeGreaterThan(0);
  });

  it('uma inscrição por discente por edital (409)', async () => {
    const editalId = await editalPublicado();
    await request(container.app).post('/api/inscricoes').set(discente).send({ editalId });
    const dup = await request(container.app).post('/api/inscricoes').set(discente).send({ editalId });
    expect(dup.status).toBe(409);
    expect(dup.body.error.details.inscricaoId).toBeTruthy();
  });

  it('RN06: rejeita arquivo que não é PDF, mesmo com Content-Type de PDF', async () => {
    const editalId = await editalPublicado();
    const criada = await request(container.app).post('/api/inscricoes').set(discente).send({ editalId });
    const res = await upload(
      `/api/inscricoes/${criada.body.id as string}/anexos/LATTES`,
      discente,
      'virus.pdf',
      Buffer.from('MZ executável'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/PDF/);
  });

  it('outro usuário não vê a inscrição (404)', async () => {
    const editalId = await editalPublicado();
    const id = await inscricaoSubmetida(editalId);
    const res = await request(container.app).get(`/api/inscricoes/${id}`).set(avaliadorFis);
    expect(res.status).toBe(404);
  });

  it('orientador que recusa devolve a inscrição ao rascunho com justificativa', async () => {
    const editalId = await editalPublicado();
    const id = await inscricaoSubmetida(editalId);

    const semMotivo = await request(container.app).post(`/api/inscricoes/${id}/vinculo`).set(docente).send({ decisao: 'RECUSAR' });
    expect(semMotivo.status).toBe(400);

    const recusa = await request(container.app)
      .post(`/api/inscricoes/${id}/vinculo`)
      .set(docente)
      .send({ decisao: 'RECUSAR', comentario: 'Estou sem vagas neste semestre.' });
    expect(recusa.status).toBe(200);
    expect(recusa.body.status).toBe('RASCUNHO');
    expect(recusa.body.vinculoStatus).toBe('RECUSADO');
  });
});

describe('Triagem, avaliação e homologação (S4/S5)', () => {
  async function propostaConfirmada(): Promise<{ editalId: string; id: string }> {
    const editalId = await editalPublicado();
    const id = await inscricaoSubmetida(editalId);
    const ok = await request(container.app).post(`/api/inscricoes/${id}/vinculo`).set(docente).send({ decisao: 'CONFIRMAR' });
    expect(ok.body.vinculoStatus).toBe('CONFIRMADO');
    return { editalId, id };
  }

  const notasAltas = [
    { criterio: 'MERITO', nota: 9 },
    { criterio: 'VIABILIDADE', nota: 8 },
    { criterio: 'ADEQUACAO', nota: 9 },
    { criterio: 'FORMACAO', nota: 8 },
  ];

  it('bloqueia avaliador do mesmo departamento do orientador (conflito de interesse)', async () => {
    const { id } = await propostaConfirmada();
    const res = await request(container.app)
      .post(`/api/triagem/${id}/avaliadores`)
      .set(gestor)
      .send({ avaliadorIds: [avaliadorDccId] });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Conflito de interesse/);
  });

  it('fluxo completo até a aprovação, com RN07 e consolidação', async () => {
    const { editalId, id } = await propostaConfirmada();

    const atribuicao = await request(container.app)
      .post(`/api/triagem/${id}/avaliadores`)
      .set(gestor)
      .send({ avaliadorIds: [avaliadorFisId, avaliadorQuiId] });
    expect(atribuicao.status).toBe(201);
    expect(atribuicao.body.inscricao.status).toBe('EM_AVALIACAO');
    expect(atribuicao.body.avaliacoes).toHaveLength(2);

    // Avaliador designado passa a ver a proposta e o PDF.
    const minhas = await request(container.app).get('/api/avaliacoes/minhas').set(avaliadorFis);
    expect(minhas.body.total).toBe(1);
    const avaliacaoFisId = minhas.body.data[0].id as string;
    const anexoId = minhas.body.data[0].inscricao.anexos[0].id as string;
    const pdf = await request(container.app).get(`/api/inscricoes/${id}/anexos/${anexoId}/arquivo`).set(avaliadorFis);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');

    // RN07: nota 5.5 < corte 7 exige parecer.
    const notasBaixas = notasAltas.map((n) => ({ ...n, nota: 5 }));
    notasBaixas[0] = { criterio: 'MERITO', nota: 7 };
    const semParecer = await request(container.app)
      .post(`/api/avaliacoes/${avaliacaoFisId}/parecer`)
      .set(avaliadorFis)
      .send({ notas: notasBaixas, parecer: '' });
    expect(semParecer.status).toBe(400);
    expect(semParecer.body.error.message).toMatch(/RN07/);

    const parecerFis = await request(container.app)
      .post(`/api/avaliacoes/${avaliacaoFisId}/parecer`)
      .set(avaliadorFis)
      .send({ notas: notasAltas, parecer: '' });
    expect(parecerFis.status).toBe(200);
    expect(parecerFis.body.notaFinal).toBe(8.5);

    const avaliacaoQuiId = (await request(container.app).get('/api/avaliacoes/minhas').set(avaliadorQui)).body.data[0].id;
    await request(container.app)
      .post(`/api/avaliacoes/${avaliacaoQuiId as string}/parecer`)
      .set(avaliadorQui)
      .send({ notas: notasAltas.map((n) => ({ ...n, nota: 7 })), parecer: 'Bom projeto.' });

    const item = await request(container.app).get(`/api/triagem/${id}`).set(gestor);
    expect(item.body.inscricao.status).toBe('AVALIADA');
    expect(item.body.consolidado).toMatchObject({ concluidas: 2, media: 7.75, divergente: false });

    const ranking = await request(container.app).get(`/api/triagem/editais/${editalId}/ranking`).set(gestor);
    expect(ranking.body.data[0].inscricao.id).toBe(id);

    const aprovada = await request(container.app)
      .post(`/api/triagem/${id}/homologacao`)
      .set(gestor)
      .send({ decisao: 'APROVAR' });
    expect(aprovada.status).toBe(200);
    expect(aprovada.body.inscricao.status).toBe('APROVADA');

    // RF18: discente recebe o resultado.
    const notifs = await request(container.app).get('/api/notificacoes').set(discente);
    expect(notifs.body.data.map((n: { tipo: string }) => n.tipo)).toContain('INSCRICAO_RESULTADO');

    // Painel do gestor reflete a alocação.
    const painel = await request(container.app).get('/api/dashboard/gestor').set(gestor);
    expect(painel.body.bolsas).toEqual({ total: 2, alocadas: 1 });
    expect(painel.body.avaliacoes.concluidas).toBe(2);

    // Vitrine pública: só aprovadas e sem dados sensíveis (RN10).
    const vitrine = await request(container.app).get('/api/publico/pesquisas');
    expect(vitrine.status).toBe(200);
    expect(vitrine.body.total).toBe(1);
    expect(vitrine.body.data[0].orientador).toEqual({ nome: 'Prof. Roberto', departamento: 'DCC' });
    expect(JSON.stringify(vitrine.body)).not.toMatch(/@|2021049281|storageKey/);

    const editais = await request(container.app).get('/api/publico/editais');
    expect(editais.body.data[0].bolsasAlocadas).toBe(1);
  });

  it('não aprova além da cota da subárea', async () => {
    const { id } = await propostaConfirmada();
    await request(container.app).post(`/api/triagem/${id}/avaliadores`).set(gestor).send({ avaliadorIds: [avaliadorFisId] });
    const avaliacaoId = (await request(container.app).get('/api/avaliacoes/minhas').set(avaliadorFis)).body.data[0].id;
    await request(container.app).post(`/api/avaliacoes/${avaliacaoId as string}/parecer`).set(avaliadorFis).send({ notas: notasAltas, parecer: '' });

    // Ocupa a única cota de 1.03 com outra inscrição aprovada.
    const ocupante = await container.inscricoesRepository.findById(id);
    await container.inscricoesRepository.create({ ...ocupante!, id: 'outra', discenteId: 'x', protocolo: 'p', status: 'APROVADA' });

    const res = await request(container.app).post(`/api/triagem/${id}/homologacao`).set(gestor).send({ decisao: 'APROVAR' });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Cota esgotada/);
  });
});

describe('Projetos e relatórios (S6)', () => {
  it('bolsista envia relatório, orientador devolve e depois aprova; CSV mascara a matrícula', async () => {
    const editalId = await editalPublicado();
    const id = await inscricaoSubmetida(editalId);
    await request(container.app).post(`/api/inscricoes/${id}/vinculo`).set(docente).send({ decisao: 'CONFIRMAR' });
    await request(container.app).post(`/api/triagem/${id}/avaliadores`).set(gestor).send({ avaliadorIds: [avaliadorFisId] });
    const avaliacaoId = (await request(container.app).get('/api/avaliacoes/minhas').set(avaliadorFis)).body.data[0].id;
    await request(container.app)
      .post(`/api/avaliacoes/${avaliacaoId as string}/parecer`)
      .set(avaliadorFis)
      .send({
        notas: [
          { criterio: 'MERITO', nota: 9 },
          { criterio: 'VIABILIDADE', nota: 9 },
          { criterio: 'ADEQUACAO', nota: 9 },
          { criterio: 'FORMACAO', nota: 9 },
        ],
        parecer: '',
      });
    await request(container.app).post(`/api/triagem/${id}/homologacao`).set(gestor).send({ decisao: 'APROVAR' });

    const meus = await request(container.app).get('/api/projetos').set(discente);
    expect(meus.body.total).toBe(1);

    const finalAntes = await upload(`/api/projetos/${id}/relatorios/FINAL`, discente, 'final.pdf');
    expect(finalAntes.status).toBe(422);

    const v1 = await upload(`/api/projetos/${id}/relatorios/PARCIAL`, discente, 'parcial.pdf');
    expect(v1.status).toBe(201);
    const devolvido = await request(container.app)
      .post(`/api/projetos/${id}/relatorios/${v1.body.id as string}/avaliacao`)
      .set(docente)
      .send({ decisao: 'DEVOLVER', comentario: 'Inclua os resultados preliminares.' });
    expect(devolvido.body.status).toBe('DEVOLVIDO');

    const v2 = await upload(`/api/projetos/${id}/relatorios/PARCIAL`, discente, 'parcial-v2.pdf');
    expect(v2.body.versao).toBe(2);
    await request(container.app)
      .post(`/api/projetos/${id}/relatorios/${v2.body.id as string}/avaliacao`)
      .set(docente)
      .send({ decisao: 'APROVAR' });

    const detalhe = await request(container.app).get(`/api/projetos/${id}`).set(docente);
    expect(detalhe.body.relatorios).toHaveLength(2);
    expect(detalhe.body.acompanhamento[0]).toMatchObject({ tipo: 'PARCIAL', situacao: 'APROVADO' });
    expect(detalhe.body.timeline.length).toBeGreaterThanOrEqual(5);

    const csv = await request(container.app).get('/api/projetos/exportacao.csv').set(gestor);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('*******281');
    expect(csv.text).not.toContain('2021049281');

    expect((await request(container.app).get('/api/projetos/exportacao.csv').set(discente)).status).toBe(403);
  });
});
