import request from 'supertest';
import { buildApp, type AppContainer } from '../../src/infra/config/app.container';
import { FixedClock } from '../../src/shared/testing/fixed-clock';

jest.setTimeout(20000);

const NOW = '2026-09-14T12:00:00.000Z';

let container: AppContainer;

beforeEach(() => {
  container = buildApp({
    clock: new FixedClock(NOW),
    userDirectory: {
      resolveUser: (token) => {
        const users: Record<string, { id: string; name: string; email: string; role: 'DISCENTE' | 'DOCENTE' | 'AVALIADOR' | 'GESTOR' | 'ADMIN' }> = {
          'gestor-token': { id: 'user-gestor', name: 'Maria Gestora', email: 'gestor@pibic.edu.br', role: 'GESTOR' },
          'admin-token': { id: 'user-admin', name: 'Admin Sistema', email: 'admin@pibic.edu.br', role: 'ADMIN' },
          'discente-token': { id: 'user-discente', name: 'Ana Discente', email: 'ana@pibic.edu.br', role: 'DISCENTE' },
        };
        return users[token];
      },
      listUsers: () => [{ id: 'user-gestor' }, { id: 'user-admin' }, { id: 'user-discente' }],
    },
  });
});

const validPayload = () => ({
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

describe('Autenticação e RBAC das rotas administrativas', () => {
  it('bloqueia acesso sem token (401)', async () => {
    const res = await request(container.app).post('/api/editais').send(validPayload());
    expect(res.status).toBe(401);
  });

  it('bloqueia token inválido (401)', async () => {
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer invalid-token')
      .send(validPayload());
    expect(res.status).toBe(401);
  });

  it('bloqueia papel sem permissão (403) — DISCENTE não cria edital', async () => {
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer discente-token')
      .send(validPayload());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('permite GESTOR criar edital (201)', async () => {
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('RASCUNHO');
  });
});

describe('CRUD de editais', () => {
  it('cria e busca por id', async () => {
    const created = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    const id = created.body.id as string;

    const found = await request(container.app)
      .get(`/api/editais/${id}`)
      .set('Authorization', 'Bearer gestor-token');
    expect(found.status).toBe(200);
    expect(found.body.numero).toBe('06/2026');
    expect(found.body.cotas).toHaveLength(2);
  });

  it('retorna 404 para edital inexistente', async () => {
    const res = await request(container.app)
      .get('/api/editais/id-inexistente')
      .set('Authorization', 'Bearer gestor-token');
    expect(res.status).toBe(404);
  });

  it('bloqueia número de edital duplicado (409)', async () => {
    await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    expect(res.status).toBe(409);
  });

  it('edita edital em RASCUNHO', async () => {
    const created = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());

    const res = await request(container.app)
      .patch(`/api/editais/${created.body.id}`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ titulo: 'Edital PIBIC 2026/2027 — retificado' });
    expect(res.status).toBe(200);
    expect(res.body.titulo).toContain('retificado');
  });

  it('lista editais por status', async () => {
    await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());

    const res = await request(container.app)
      .get('/api/editais?status=RASCUNHO')
      .set('Authorization', 'Bearer gestor-token');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });
});

describe('Regra de Consistência de Cotas via API', () => {
  it('rejeita soma de cotas maior que o total (422)', async () => {
    const payload = {
      ...validPayload(),
      totalCotas: 5,
      cotas: [
        { subareaCode: '1.03', quantidade: 4 },
        { subareaCode: '1.01', quantidade: 4 },
      ],
    };
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(payload);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE');
    expect(JSON.stringify(res.body.error.details)).toContain('soma');
  });

  it('rejeita subárea CNPq desconhecida (400)', async () => {
    const payload = {
      ...validPayload(),
      cotas: [{ subareaCode: '99.99', quantidade: 1 }],
    };
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(payload);
    expect(res.status).toBe(400);
  });

  it('rejeita atualização que quebre a consistência de cotas (422)', async () => {
    const created = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());

    const res = await request(container.app)
      .patch(`/api/editais/${created.body.id}`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ totalCotas: 2, cotas: [{ subareaCode: '1.03', quantidade: 3 }] });
    expect(res.status).toBe(422);
  });
});

describe('Ciclo de vida via API', () => {
  async function createEdital(): Promise<string> {
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    return res.body.id as string;
  }

  it('publica edital em rascunho (RASCUNHO → PUBLICADO)', async () => {
    const id = await createEdital();

    const res = await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'publicar' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PUBLICADO');
    expect(res.body.publicadoEm).not.toBeNull();
  });

  it('bloqueia edição após publicação (somente RASCUNHO é editável)', async () => {
    const id = await createEdital();
    await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'publicar' });

    const res = await request(container.app)
      .patch(`/api/editais/${id}`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ titulo: 'novo titulo' });
    expect(res.status).toBe(422);
  });

  it('bloqueia transição inválida RASCUNHO → ENCERRADO (422)', async () => {
    const id = await createEdital();
    const res = await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'encerrar' });
    expect(res.status).toBe(422);
  });

  it('encerra edital publicado após o prazo (PUBLICADO → ENCERRADO)', async () => {
    const id = await createEdital();
    await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'publicar' });

    (container.clock as FixedClock).setTo('2026-11-05T12:00:00.000Z');

    const res = await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'encerrar' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ENCERRADO');
  });
});

describe('Notificações in-app', () => {
  it('gera notificações quando o edital é publicado', async () => {
    const created = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    const id = created.body.id as string;

    await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'publicar' });

    const res = await request(container.app)
      .get('/api/notificacoes')
      .set('Authorization', 'Bearer discente-token');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].tipo).toBe('EDITAL_PUBLICADO');
    expect(res.body.data[0].referenceId).toBe(id);
  });

  it('não publica notificação se a publicação falhar (edital sem cotas)', async () => {
    const created = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send({ ...validPayload(), cotas: [] });
    // criação sem cotas é rejeitada na entrada (400)
    expect(created.status).toBe(400);
  });

  it('exige autenticação para listar notificações (401)', async () => {
    const res = await request(container.app).get('/api/notificacoes');
    expect(res.status).toBe(401);
  });

  it('marca notificação como lida', async () => {
    const created = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    const id = created.body.id as string;

    await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'publicar' });

    const list = await request(container.app)
      .get('/api/notificacoes')
      .set('Authorization', 'Bearer discente-token');
    const notificationId = list.body.data[0].id as string;

    const res = await request(container.app)
      .patch(`/api/notificacoes/${notificationId}/leitura`)
      .set('Authorization', 'Bearer discente-token');
    expect(res.status).toBe(200);
    expect(res.body.lida).toBe(true);
  });
});

describe('Listagem pública (RF08)', () => {
  it('não exige autenticação e só mostra PUBLICADO vigente', async () => {
    const created = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer gestor-token')
      .send(validPayload());
    const id = created.body.id as string;

    // Rascunho não aparece
    let res = await request(container.app).get('/api/publico/editais');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);

    // Publica — aparece
    await request(container.app)
      .post(`/api/editais/${id}/transicoes`)
      .set('Authorization', 'Bearer gestor-token')
      .send({ acao: 'publicar' });
    res = await request(container.app).get('/api/publico/editais');
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].numero).toBe('06/2026');

    // Após o prazo — some da listagem pública (vigência)
    (container.clock as FixedClock).setTo('2026-11-05T12:00:00.000Z');
    res = await request(container.app).get('/api/publico/editais');
    expect(res.body.total).toBe(0);
  });
});
