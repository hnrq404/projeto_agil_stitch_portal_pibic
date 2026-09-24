/**
 * E2E — Jornada completa do GESTOR (Sprint 2):
 *   1. autentica-se (Bearer)
 *   2. cria edital com cotas por subárea CNPq
 *   3. tenta quebrar a regra de consistência de cotas (bloqueado)
 *   4. ajusta as cotas e edita o rascunho
 *   5. publica o edital (RASCUNHO → PUBLICADO)
 *   6. verifica notificação in-app dos usuários
 *   7. verifica listagem pública
 *   8. avança o tempo e encerra o edital
 */
import request from 'supertest';
import { buildApp, type AppContainer } from '../../src/infra/config/app.container';
import { FixedClock } from '../../src/shared/testing/fixed-clock';

jest.setTimeout(30000);

let container: AppContainer;
const GESTOR = 'Bearer gestor-token';

beforeEach(() => {
  container = buildApp({
    clock: new FixedClock('2026-09-14T12:00:00.000Z'),
    userDirectory: {
      resolveUser: (token) => {
        const users: Record<string, { id: string; name: string; email: string; role: 'GESTOR' | 'DISCENTE' | 'DOCENTE' | 'AVALIADOR' }> = {
          'gestor-token': { id: 'user-gestor', name: 'Maria Gestora', email: 'gestor@pibic.edu.br', role: 'GESTOR' },
          'discente-token': { id: 'user-discente', name: 'Ana Discente', email: 'ana@pibic.edu.br', role: 'DISCENTE' },
        };
        return users[token];
      },
      listUsers: () => [{ id: 'user-gestor' }, { id: 'user-discente' }],
    },
  });
});

async function createEdital(overrides: Record<string, unknown> = {}): Promise<request.Response> {
  return request(container.app)
    .post('/api/editais')
    .set('Authorization', GESTOR)
    .send({
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
      ...overrides,
    });
}

it('E2E: jornada completa do gestor', async () => {
  // ── 1. Health check
  const health = await request(container.app).get('/api/health');
  expect(health.status).toBe(200);

  // ── 2. Criação do edital com cotas coerentes
  const created = await createEdital();
  expect(created.status).toBe(201);
  expect(created.body.status).toBe('RASCUNHO');
  const editalId = created.body.id as string;

  // ── 3. Tentativa de burlar a regra de cotas (soma 6 > total 5) → 422
  const brokenCotas = await request(container.app)
    .patch(`/api/editais/${editalId}`)
    .set('Authorization', GESTOR)
    .send({ totalCotas: 5, cotas: [{ subareaCode: '1.03', quantidade: 6 }] });
  expect(brokenCotas.status).toBe(422);

  // ── 4. Ajuste legítimo das cotas + edição do rascunho
  const adjusted = await request(container.app)
    .patch(`/api/editais/${editalId}`)
    .set('Authorization', GESTOR)
    .send({
      totalCotas: 6,
      cotas: [
        { subareaCode: '1.03', quantidade: 4 },
        { subareaCode: '1.01', quantidade: 2 },
      ],
      titulo: 'Edital PIBIC 2026/2027 — retificação I',
    });
  expect(adjusted.status).toBe(200);
  expect(adjusted.body.totalCotas).toBe(6);

  // ── 5. Publicação
  const published = await request(container.app)
    .post(`/api/editais/${editalId}/transicoes`)
    .set('Authorization', GESTOR)
    .send({ acao: 'publicar' });
  expect(published.status).toBe(200);
  expect(published.body.status).toBe('PUBLICADO');
  expect(published.body.publicadoEm).toBeTruthy();

  // ── 6. Notificação in-app chegou aos usuários
  const notif = await request(container.app)
    .get('/api/notificacoes')
    .set('Authorization', 'Bearer discente-token');
  expect(notif.status).toBe(200);
  expect(notif.body.total).toBe(1);
  expect(notif.body.data[0].tipo).toBe('EDITAL_PUBLICADO');
  expect(notif.body.data[0].referenceId).toBe(editalId);

  // ── 7. Listagem pública mostra o edital vigente
  const publicList = await request(container.app).get('/api/publico/editais');
  expect(publicList.status).toBe(200);
  expect(publicList.body.total).toBe(1);
  expect(publicList.body.data[0].id).toBe(editalId);

  // ── 8. Edital publicado não é mais editável (regra de domínio, não validação de schema)
  const editAfterPublish = await request(container.app)
    .patch(`/api/editais/${editalId}`)
    .set('Authorization', GESTOR)
    .send({ titulo: 'Título Válido de Teste' });
  expect(editAfterPublish.status).toBe(422);

  // ── 9. Avança o tempo além do prazo e encerra
  (container.clock as FixedClock).setTo('2026-11-05T12:00:00.000Z');
  const closed = await request(container.app)
    .post(`/api/editais/${editalId}/transicoes`)
    .set('Authorization', GESTOR)
    .send({ acao: 'encerrar' });
  expect(closed.status).toBe(200);
  expect(closed.body.status).toBe('ENCERRADO');

  // ── 10. Edital encerrado some da listagem pública e não pode ser reaberto
  const publicAfterClose = await request(container.app).get('/api/publico/editais');
  expect(publicAfterClose.body.total).toBe(0);

  const reopen = await request(container.app)
    .post(`/api/editais/${editalId}/transicoes`)
    .set('Authorization', GESTOR)
    .send({ acao: 'publicar' });
  expect(reopen.status).toBe(422);
});
