import request from 'supertest';

import type { AppContainer } from '../../src/infra/config/app.container';
import { buildTestApp } from '../helpers/app';
import { FixedClock } from '../../src/shared/testing/fixed-clock';
import { criarELogar, criarUsuario } from '../helpers/usuarios';

jest.setTimeout(20000);

const NOW = '2026-09-14T12:00:00.000Z';

let container: AppContainer;

beforeEach(() => {
  container = buildTestApp({ clock: new FixedClock(NOW), jwtSecret: 'auditoria-secret' });
});

const editalPayload = () => ({
  numero: '07/2026',
  titulo: 'Edital PIBIC 2026/2027',
  descricao: 'Programa Institucional de Bolsas de Iniciação Científica',
  tipoBolsa: 'PIBIC',
  totalCotas: 2,
  cotas: [{ subareaCode: '1.03', quantidade: 2 }],
  dataInicioInscricoes: '2026-09-15T00:00:00.000Z',
  dataFimInscricoes: '2026-10-31T23:59:59.000Z',
});

function gestora() {
  return criarELogar(container, { nome: 'Gestora Auditada', email: 'gestora@pibic.edu.br', role: 'GESTOR' });
}

describe('Trilha de auditoria', () => {
  it('registra criação e publicação do edital com o autor, mais recentes primeiro', async () => {
    const { usuario, auth } = await gestora();
    const criado = await request(container.app).post('/api/editais').set(auth).send(editalPayload());
    const id = criado.body.id as string;
    await request(container.app).post(`/api/editais/${id}/transicoes`).set(auth).send({ acao: 'publicar' });

    const res = await request(container.app).get(`/api/auditoria?entidade=EDITAL&entidadeId=${id}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map((r: { acao: string }) => r.acao).sort()).toEqual(['EDITAL_CRIADO', 'EDITAL_PUBLICADO']);
    expect(res.body.data[0]).toMatchObject({
      entidade: 'EDITAL',
      entidadeId: id,
      actor: { id: usuario.id, nome: 'Gestora Auditada' },
      detalhes: { numero: '07/2026' },
      criadoEm: NOW,
    });
  });

  it('registra a troca de papel com o valor anterior e o novo', async () => {
    const { auth } = await gestora();
    const docente = await criarUsuario(container, { nome: 'Prof. Paulo', email: 'paulo@pibic.edu.br', role: 'DOCENTE' });

    await request(container.app).patch(`/api/usuarios/${docente.id}`).set(auth).send({ role: 'GESTOR' });

    const res = await request(container.app).get(`/api/auditoria?entidade=USUARIO&entidadeId=${docente.id}`).set(auth);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      acao: 'USUARIO_ATUALIZADO',
      detalhes: { email: 'paulo@pibic.edu.br', role: { de: 'DOCENTE', para: 'GESTOR' } },
    });
  });

  it('só a gestão consulta, e filtros inválidos respondem 400', async () => {
    const { auth } = await gestora();
    const docente = await criarELogar(container, { nome: 'Prof. Paulo', email: 'paulo@pibic.edu.br', role: 'DOCENTE' });

    expect((await request(container.app).get('/api/auditoria').set(docente.auth)).status).toBe(403);
    expect((await request(container.app).get('/api/auditoria')).status).toBe(401);
    expect((await request(container.app).get('/api/auditoria?entidade=QUALQUER').set(auth)).status).toBe(400);
    expect((await request(container.app).get('/api/auditoria?limite=1000').set(auth)).status).toBe(400);
  });

  it('falha ao gravar a auditoria não desfaz nem quebra a ação principal', async () => {
    const erroNoLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    container = buildTestApp({
      clock: new FixedClock(NOW),
      jwtSecret: 'auditoria-secret',
      auditoriaRepository: {
        create: async () => {
          throw new Error('banco de auditoria fora do ar');
        },
        list: async () => ({ data: [], total: 0 }),
      },
    });
    const { auth } = await gestora();

    const res = await request(container.app).post('/api/editais').set(auth).send(editalPayload());

    expect(res.status).toBe(201);
    expect(erroNoLog).toHaveBeenCalledWith(
      '[auditoria] Falha ao registrar',
      expect.objectContaining({ acao: 'EDITAL_CRIADO' }),
      expect.any(Error),
    );
    erroNoLog.mockRestore();
  });
});
