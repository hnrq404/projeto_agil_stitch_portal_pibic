import request from 'supertest';
import { buildApp, type AppContainer } from '../../src/infra/config/app.container';

jest.setTimeout(20000);

let container: AppContainer;

beforeEach(() => {
  // JWT real + repositórios in-memory frescos por cenário.
  container = buildApp({ jwtSecret: 'test-secret' });
});

const gestorPayload = () => ({
  nome: 'Maria Gestora',
  email: 'maria.gestora@pibic.edu.br',
  senha: 'senha-segura-123',
  role: 'GESTOR',
});

const usuarioPayload = () => ({
  nome: 'Ana Visitante',
  email: 'ana.visitante@pibic.edu.br',
  senha: 'senha-segura-456',
  role: 'USUARIO',
});

describe('POST /api/auth/register', () => {
  it('cadastra GESTOR com hash bcrypt e retorna JWT válido', async () => {
    const res = await request(container.app).post('/api/auth/register').send(gestorPayload());

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.nome).toBe('Maria Gestora');
    expect(res.body.usuario.email).toBe('maria.gestora@pibic.edu.br');
    expect(res.body.usuario.role).toBe('GESTOR');
    // O hash NUNCA atravessa a API:
    expect(JSON.stringify(res.body)).not.toContain('senhaHash');

    const stored = await container.usuariosRepository.findByEmail('maria.gestora@pibic.edu.br');
    expect(stored).toBeDefined();
    expect(stored!.senhaHash).not.toBe('senha-segura-123');
    expect(stored!.senhaHash.startsWith('$2')).toBe(true); // formato bcrypt
  });

  it('cadastra USUARIO (visitante) com role correta', async () => {
    const res = await request(container.app).post('/api/auth/register').send(usuarioPayload());
    expect(res.status).toBe(201);
    expect(res.body.usuario.role).toBe('USUARIO');
  });

  it('rejeita e-mail duplicado (409)', async () => {
    await request(container.app).post('/api/auth/register').send(gestorPayload());
    const res = await request(container.app).post('/api/auth/register').send(gestorPayload());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejeita payload inválido (400) — senha curta, e-mail malformado, role inválida', async () => {
    const cases = [
      { ...gestorPayload(), senha: '123' },
      { ...gestorPayload(), email: 'nao-e-email' },
      { ...gestorPayload(), role: 'SUPERUSER' },
      { nome: 'x', email: 'x@x.com', senha: '123456' }, // sem role
    ];
    for (const payload of cases) {
      const res = await request(container.app).post('/api/auth/register').send(payload);
      expect(res.status).toBe(400);
    }
  });
});

describe('POST /api/auth/login', () => {
  it('o MESMO usuário cadastrado autentica no login (fluxo completo)', async () => {
    await request(container.app).post('/api/auth/register').send(gestorPayload());

    const res = await request(container.app).post('/api/auth/login').send({
      email: 'maria.gestora@pibic.edu.br',
      senha: 'senha-segura-123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.email).toBe('maria.gestora@pibic.edu.br');
    expect(res.body.usuario.role).toBe('GESTOR');
  });

  it('autentica com e-mail em caixa diferente (normalização)', async () => {
    await request(container.app).post('/api/auth/register').send(usuarioPayload());

    const res = await request(container.app).post('/api/auth/login').send({
      email: 'ANA.VISITANTE@PIBIC.EDU.BR',
      senha: 'senha-segura-456',
    });
    expect(res.status).toBe(200);
  });

  it('rejeita senha incorreta (401)', async () => {
    await request(container.app).post('/api/auth/register').send(gestorPayload());
    const res = await request(container.app).post('/api/auth/login').send({
      email: 'maria.gestora@pibic.edu.br',
      senha: 'errada!',
    });
    expect(res.status).toBe(401);
  });

  it('rejeita e-mail inexistente (401) sem vazar existência', async () => {
    const res = await request(container.app).post('/api/auth/login').send({
      email: 'fantasma@pibic.edu.br',
      senha: 'qualquer',
    });
    expect(res.status).toBe(401);
  });
});

describe('JWT nas rotas protegidas (integração auth ↔ editais)', () => {
  async function registerAndLogin(role: 'GESTOR' | 'USUARIO') {
    const payload =
      role === 'GESTOR'
        ? gestorPayload()
        : usuarioPayload();
    await request(container.app).post('/api/auth/register').send(payload);
    const login = await request(container.app).post('/api/auth/login').send({
      email: payload.email,
      senha: payload.senha,
    });
    return login.body.token as string;
  }

  const validEdital = () => ({
    numero: '06/2026',
    titulo: 'Edital PIBIC 2026/2027',
    tipoBolsa: 'PIBIC',
    totalCotas: 5,
    cotas: [
      { subareaCode: '1.03', quantidade: 3 },
      { subareaCode: '1.01', quantidade: 2 },
    ],
    dataInicioInscricoes: '2026-09-15T00:00:00.000Z',
    dataFimInscricoes: '2027-10-31T23:59:59.000Z',
  });

  it('token JWT emitido no login abre as rotas de gestor', async () => {
    const token = await registerAndLogin('GESTOR');
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', `Bearer ${token}`)
      .send(validEdital());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('RASCUNHO');
  });

  it('USUARIO autenticado recebe 403 nas rotas de gestor (RBAC com JWT real)', async () => {
    const token = await registerAndLogin('USUARIO');
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', `Bearer ${token}`)
      .send(validEdital());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('token forjado/asssinatura inválida → 401', async () => {
    const res = await request(container.app)
      .post('/api/editais')
      .set('Authorization', 'Bearer header.forjado.signature')
      .send(validEdital());
    expect(res.status).toBe(401);
  });
});
