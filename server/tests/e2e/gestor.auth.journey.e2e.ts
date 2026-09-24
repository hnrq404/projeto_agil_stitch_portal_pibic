/**
 * E2E (API) — Jornada completa com AUTENTICAÇÃO REAL + persistência REAL:
 *   1. cadastra uma conta GESTOR (bcrypt no banco SQLite)
 *   2. faz login e recebe JWT
 *   3. cria edital com cotas por subárea CNPq
 *   4. tenta quebrar a regra de consistência de cotas (bloqueado)
 *   5. publica o edital (RASCUNHO → PUBLICADO) → notificação in-app
 *   6. verifica vitrine pública
 *   7. encerra o edital após o prazo
 *
 * Roda sobre Prisma/SQLite real (usePrisma: true) — o mesmo caminho do bootstrap.
 */
import request from 'supertest';
import { buildApp, type AppContainer } from '../../src/infra/config/app.container';
import { loadEnv } from '../../src/infra/config/env';
import { FixedClock } from '../../src/shared/testing/fixed-clock';

jest.setTimeout(60000);

loadEnv();

let container: AppContainer;

beforeAll(async () => {
  // Prisma REAL + clock congelado: prazos determinísticos (publicação/encerramento).
  container = buildApp({
    usePrisma: true,
    jwtSecret: 'e2e-secret',
    clock: new FixedClock('2026-09-14T12:00:00.000Z'),
  });
  await container.usuariosRepository.clear();
  await container.editaisRepository.clear();
  await container.notificacoesRepository.clear();
});

afterAll(async () => {
  await container.disconnect?.();
});

const GESTOR_EMAIL = 'gestor.e2e@pibic.edu.br';
const GESTOR_SENHA = 'senha-segura-e2e';

const editalPayload = () => ({
  numero: '06/2026',
  titulo: 'Edital PIBIC 2026/2027',
  descricao: 'Programa Institucional de Bolsas de Iniciação Científica',
  tipoBolsa: 'PIBIC',
  totalCotas: 5,
  cotas: [
    { subareaCode: '1.03', quantidade: 3 },
    { subareaCode: '1.01', quantidade: 2 },
  ],
  dataInicioInscricoes: '2026-09-15T00:00:00.000Z',
  dataFimInscricoes: '2026-10-31T23:59:59.000Z',
});

it('E2E: cadastro → login → criar edital → cotas → publicar → vitrine → encerrar', async () => {
  // ── 1. Cadastro da conta GESTOR (persistida com hash bcrypt)
  const registered = await request(container.app).post('/api/auth/register').send({
    nome: 'Gestor E2E',
    email: GESTOR_EMAIL,
    senha: GESTOR_SENHA,
    role: 'GESTOR',
  });
  expect(registered.status).toBe(201);
  expect(registered.body.usuario.role).toBe('GESTOR');

  // ── 2. Login do MESMO usuário → JWT
  const login = await request(container.app).post('/api/auth/login').send({
    email: GESTOR_EMAIL,
    senha: GESTOR_SENHA,
  });
  expect(login.status).toBe(200);
  const token = login.body.token as string;
  const auth = { Authorization: `Bearer ${token}` };

  // Também cadastra um usuário comum para receber a notificação de publicação.
  await request(container.app).post('/api/auth/register').send({
    nome: 'Visitante E2E',
    email: 'visitante.e2e@pibic.edu.br',
    senha: 'senha-visitante',
    role: 'USUARIO',
  });

  // ── 3. Criação do edital com cotas coerentes
  const created = await request(container.app)
    .post('/api/editais')
    .set(auth)
    .send(editalPayload());
  expect(created.status).toBe(201);
  expect(created.body.status).toBe('RASCUNHO');
  const editalId = created.body.id as string;

  // ── 4. Regra de consistência de cotas: soma 6 > total 5 → 422
  const broken = await request(container.app)
    .post('/api/editais')
    .set(auth)
    .send({ ...editalPayload(), numero: '07/2026', cotas: [{ subareaCode: '1.03', quantidade: 6 }] });
  expect(broken.status).toBe(422);
  expect(broken.body.error.code).toBe('UNPROCESSABLE');

  // ── 5. Publicação → status PUBLICADO + notificações in-app
  const published = await request(container.app)
    .post(`/api/editais/${editalId}/transicoes`)
    .set(auth)
    .send({ acao: 'publicar' });
  expect(published.status).toBe(200);
  expect(published.body.status).toBe('PUBLICADO');
  expect(published.body.publicadoEm).toBeTruthy();

  // ── 6. Notificações in-app chegaram a ambos os usuários cadastrados
  const gestorNotifs = await request(container.app)
    .get('/api/notificacoes')
    .set(auth);
  expect(gestorNotifs.status).toBe(200);
  expect(gestorNotifs.body.total).toBe(1);
  expect(gestorNotifs.body.data[0].referenceId).toBe(editalId);

  const visitanteLogin = await request(container.app).post('/api/auth/login').send({
    email: 'visitante.e2e@pibic.edu.br',
    senha: 'senha-visitante',
  });
  const visitanteNotifs = await request(container.app)
    .get('/api/notificacoes')
    .set('Authorization', `Bearer ${visitanteLogin.body.token}`);
  expect(visitanteNotifs.body.total).toBe(1);
  expect(visitanteNotifs.body.data[0].tipo).toBe('EDITAL_PUBLICADO');

  // ── 7. Vitrine pública (sem auth) mostra o edital vigente
  const publicList = await request(container.app).get('/api/publico/editais');
  expect(publicList.status).toBe(200);
  expect(publicList.body.total).toBe(1);
  expect(publicList.body.data[0].id).toBe(editalId);

  // ── 8. Edital publicado não é mais editável
  const editAfterPublish = await request(container.app)
    .patch(`/api/editais/${editalId}`)
    .set(auth)
    .send({ titulo: 'Título Válido de Teste' });
  expect(editAfterPublish.status).toBe(422);

  // ── 9. Encerramento após o prazo + persistência real (nova leitura do banco)
  (container.clock as FixedClock).setTo('2026-11-05T12:00:00.000Z');
  const closed = await request(container.app)
    .post(`/api/editais/${editalId}/transicoes`)
    .set(auth)
    .send({ acao: 'encerrar' });
  expect(closed.status).toBe(200);
  expect(closed.body.status).toBe('ENCERRADO');

  const persisted = await container.editaisRepository.findById(editalId);
  expect(persisted?.status).toBe('ENCERRADO');

  const publicAfterClose = await request(container.app).get('/api/publico/editais');
  expect(publicAfterClose.body.total).toBe(0);
});
