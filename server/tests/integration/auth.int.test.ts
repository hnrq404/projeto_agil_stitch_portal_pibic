import request from 'supertest';
import { buildApp, type AppContainer } from '../../src/infra/config/app.container';
import { criarELogar, criarUsuario } from '../helpers/usuarios';

jest.setTimeout(20000);

let container: AppContainer;

beforeEach(() => {
  // JWT real + repositórios in-memory frescos por cenário.
  container = buildApp({ jwtSecret: 'test-secret' });
});

const discentePayload = () => ({
  nome: 'Maria Discente',
  email: 'maria.discente@pibic.edu.br',
  senha: 'senha-segura-123',
  role: 'DISCENTE',
  departamento: 'dcc',
  matricula: '2023001234',
});

const usuarioPayload = () => ({
  nome: 'Ana Visitante',
  email: 'ana.visitante@pibic.edu.br',
  senha: 'senha-segura-456',
  role: 'USUARIO',
});

describe('POST /api/auth/register', () => {
  it('cadastra DISCENTE com hash bcrypt e retorna JWT válido', async () => {
    const res = await request(container.app).post('/api/auth/register').send(discentePayload());

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.nome).toBe('Maria Discente');
    expect(res.body.usuario.email).toBe('maria.discente@pibic.edu.br');
    expect(res.body.usuario.role).toBe('DISCENTE');
    expect(res.body.usuario.departamento).toBe('DCC');
    // O hash NUNCA atravessa a API:
    expect(JSON.stringify(res.body)).not.toContain('senhaHash');

    const stored = await container.usuariosRepository.findByEmail('maria.discente@pibic.edu.br');
    expect(stored).toBeDefined();
    expect(stored!.senhaHash).not.toBe('senha-segura-123');
    expect(stored!.senhaHash.startsWith('$2')).toBe(true); // formato bcrypt
  });

  it('cadastra USUARIO (visitante) com role correta', async () => {
    const res = await request(container.app).post('/api/auth/register').send(usuarioPayload());
    expect(res.status).toBe(201);
    expect(res.body.usuario.role).toBe('USUARIO');
  });

  it('não permite escolher GESTOR, AVALIADOR ou ADMIN no auto-cadastro (400)', async () => {
    for (const role of ['GESTOR', 'AVALIADOR', 'ADMIN']) {
      const res = await request(container.app)
        .post('/api/auth/register')
        .send({ ...discentePayload(), role });
      expect(res.status).toBe(400);
    }
    expect(await container.usuariosRepository.list()).toHaveLength(0);
  });

  it('rejeita e-mail duplicado (409)', async () => {
    await request(container.app).post('/api/auth/register').send(discentePayload());
    const res = await request(container.app).post('/api/auth/register').send(discentePayload());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejeita payload inválido (400) — senha curta, e-mail malformado, role inválida', async () => {
    const cases = [
      { ...discentePayload(), senha: '123' },
      { ...discentePayload(), email: 'nao-e-email' },
      { ...discentePayload(), role: 'SUPERUSER' },
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
    await request(container.app).post('/api/auth/register').send(discentePayload());

    const res = await request(container.app).post('/api/auth/login').send({
      email: 'maria.discente@pibic.edu.br',
      senha: 'senha-segura-123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario.email).toBe('maria.discente@pibic.edu.br');
    expect(res.body.usuario.role).toBe('DISCENTE');
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
    await request(container.app).post('/api/auth/register').send(discentePayload());
    const res = await request(container.app).post('/api/auth/login').send({
      email: 'maria.discente@pibic.edu.br',
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
    if (role === 'GESTOR') {
      const { auth } = await criarELogar(container, {
        nome: 'Maria Gestora',
        email: 'maria.gestora@pibic.edu.br',
        role: 'GESTOR',
      });
      return auth.Authorization.replace('Bearer ', '');
    }
    const payload = usuarioPayload();
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

describe('Gestão de usuários (S1.2) e papéis no token', () => {
  it('troca de papel vale na próxima requisição, com o mesmo token (RN11)', async () => {
    const gestor = await criarELogar(container, {
      nome: 'Gestora',
      email: 'gestora@pibic.edu.br',
      role: 'GESTOR',
    });
    const reg = await request(container.app).post('/api/auth/register').send(usuarioPayload());
    const tokenVisitante = `Bearer ${reg.body.token as string}`;

    const antes = await request(container.app)
      .get('/api/avaliacoes/minhas')
      .set('Authorization', tokenVisitante);
    expect(antes.status).toBe(403);

    const promovido = await request(container.app)
      .patch(`/api/usuarios/${reg.body.usuario.id as string}`)
      .set(gestor.auth)
      .send({ role: 'AVALIADOR', departamento: 'fis' });
    expect(promovido.status).toBe(200);
    expect(promovido.body.role).toBe('AVALIADOR');
    expect(promovido.body.departamento).toBe('FIS');

    const depois = await request(container.app)
      .get('/api/avaliacoes/minhas')
      .set('Authorization', tokenVisitante);
    expect(depois.status).toBe(200);
  });

  it('gestor não altera o próprio papel (422)', async () => {
    const gestor = await criarELogar(container, {
      nome: 'Gestora',
      email: 'gestora@pibic.edu.br',
      role: 'GESTOR',
    });
    const proprio = await request(container.app)
      .patch(`/api/usuarios/${gestor.usuario.id}`)
      .set(gestor.auth)
      .send({ role: 'DISCENTE' });
    expect(proprio.status).toBe(422);
  });

  it('lista de usuários é restrita ao gestor; a de docentes é aberta a autenticados', async () => {
    await criarUsuario(container, {
      nome: 'Prof. Paulo',
      email: 'paulo@pibic.edu.br',
      role: 'DOCENTE',
      departamento: 'DCC',
    });
    const reg = await request(container.app).post('/api/auth/register').send(usuarioPayload());
    const auth = { Authorization: `Bearer ${reg.body.token as string}` };

    expect((await request(container.app).get('/api/usuarios').set(auth)).status).toBe(403);
    const docentes = await request(container.app).get('/api/usuarios/docentes').set(auth);
    expect(docentes.status).toBe(200);
    expect(docentes.body.data).toEqual([
      { id: expect.any(String), nome: 'Prof. Paulo', departamento: 'DCC' },
    ]);
  });
});

describe('Endurecimento da API', () => {
  it('responde com headers de segurança', async () => {
    const res = await request(container.app).get('/api/health');

    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('bloqueia o login após 10 senhas erradas, mesmo com a senha certa depois', async () => {
    const app = buildApp({ jwtSecret: 'test-secret', authRateLimit: true }).app;
    await request(app).post('/api/auth/register').send(discentePayload());

    for (let i = 0; i < 10; i += 1) {
      const falha = await request(app)
        .post('/api/auth/login')
        .send({ email: discentePayload().email, senha: 'senha-errada' });
      expect(falha.status).toBe(401);
    }

    const bloqueado = await request(app)
      .post('/api/auth/login')
      .send({ email: discentePayload().email, senha: discentePayload().senha });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('logins bem-sucedidos não contam para o limite', async () => {
    const app = buildApp({ jwtSecret: 'test-secret', authRateLimit: true }).app;
    await request(app).post('/api/auth/register').send(discentePayload());

    for (let i = 0; i < 12; i += 1) {
      const ok = await request(app)
        .post('/api/auth/login')
        .send({ email: discentePayload().email, senha: discentePayload().senha });
      expect(ok.status).toBe(200);
    }
  });
});
