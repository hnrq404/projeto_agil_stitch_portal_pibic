import request from 'supertest';

import type { AppContainer } from '../../src/infra/config/app.container';
import { EmailIndisponivel } from '../../src/shared/email/email.sender';
import { buildTestApp } from '../helpers/app';
import { anexarCurriculo, cadastrar, tokenDoUltimoEmail } from '../helpers/conta';

jest.setTimeout(20000);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

let container: AppContainer;

beforeEach(() => {
  container = buildTestApp({ jwtSecret: 'conta-secret' });
});

const aluno = () => ({
  nome: 'Lucas Aluno',
  email: 'lucas.aluno@unicap.br',
  senha: 'senha-segura-123',
  role: 'DISCENTE',
  matricula: '2024001',
});

describe('Esqueci minha senha', () => {
  it('envia o link, troca a senha, derruba as sessões antigas e o link não vale de novo', async () => {
    const sessaoAntiga = (await cadastrar(container, aluno())).body.token as string;

    const pedido = await request(container.app).post('/api/auth/esqueci-senha').send({ email: 'lucas.aluno@unicap.br' });
    expect(pedido.status).toBe(202);
    const token = tokenDoUltimoEmail(container, 'lucas.aluno@unicap.br');

    const redefinida = await request(container.app)
      .post('/api/auth/redefinir-senha')
      .send({ token, novaSenha: 'nova-senha-789' });
    expect(redefinida.status).toBe(200);
    expect(redefinida.body.token).toBeTruthy();

    expect((await request(container.app).get('/api/auth/me').set('Authorization', `Bearer ${sessaoAntiga}`)).status).toBe(401);
    const login = await request(container.app)
      .post('/api/auth/login')
      .send({ email: 'lucas.aluno@unicap.br', senha: 'nova-senha-789' });
    expect(login.status).toBe(200);

    const reuso = await request(container.app).post('/api/auth/redefinir-senha').send({ token, novaSenha: 'outra-senha-111' });
    expect(reuso.status).toBe(400);
  });

  it('responde igual para e-mail sem conta e não envia nada', async () => {
    const res = await request(container.app).post('/api/auth/esqueci-senha').send({ email: 'ninguem@unicap.br' });
    expect(res.status).toBe(202);
    expect(() => tokenDoUltimoEmail(container, 'ninguem@unicap.br')).toThrow();
  });

  it('o link de nova senha também confirma uma conta que ainda estava pendente', async () => {
    await request(container.app).post('/api/auth/register').send(aluno());
    await request(container.app).post('/api/auth/esqueci-senha').send({ email: 'lucas.aluno@unicap.br' });
    const token = tokenDoUltimoEmail(container, 'lucas.aluno@unicap.br');

    expect((await request(container.app).post('/api/auth/redefinir-senha').send({ token, novaSenha: 'nova-senha-789' })).status).toBe(200);
    const login = await request(container.app)
      .post('/api/auth/login')
      .send({ email: 'lucas.aluno@unicap.br', senha: 'nova-senha-789' });
    expect(login.status).toBe(200);
  });
});

describe('Currículo Lattes do aluno', () => {
  it('é enviado logo após o cadastro, antes de confirmar o e-mail, com a chave devolvida pelo cadastro', async () => {
    const cadastro = await request(container.app).post('/api/auth/register').send(aluno());
    const { chave, upload } = cadastro.body.envioCurriculo as { chave: string; upload: { url: string } };
    await request(container.app).put(upload.url).set('Content-Type', 'application/pdf').send(PDF);

    const confirmado = await request(container.app)
      .put('/api/auth/cadastro/curriculo')
      .send({ usuarioId: cadastro.body.usuarioId as string, chave, nome: 'meu-lattes.pdf' });
    expect(confirmado.status).toBe(204);

    const sessao = await request(container.app)
      .post('/api/auth/verificar-email')
      .send({ token: tokenDoUltimoEmail(container, 'lucas.aluno@unicap.br') });
    expect(sessao.body.usuario.curriculo).toMatchObject({ nome: 'meu-lattes.pdf', tamanho: PDF.length });

    // Depois da confirmação, a etapa do cadastro fecha: a troca passa a ser em "Meu perfil".
    const tardio = await request(container.app)
      .put('/api/auth/cadastro/curriculo')
      .send({ usuarioId: cadastro.body.usuarioId as string, chave, nome: 'outro.pdf' });
    expect(tardio.status).toBe(403);
  });

  it('a chave do cadastro de um aluno não serve para outro', async () => {
    const lucas = await request(container.app).post('/api/auth/register').send(aluno());
    const maria = await request(container.app)
      .post('/api/auth/register')
      .send({ ...aluno(), nome: 'Maria Aluna', email: 'maria.aluna@unicap.br' });
    const envio = lucas.body.envioCurriculo as { chave: string; upload: { url: string } };
    await request(container.app).put(envio.upload.url).set('Content-Type', 'application/pdf').send(PDF);

    const res = await request(container.app)
      .put('/api/auth/cadastro/curriculo')
      .send({ usuarioId: maria.body.usuarioId as string, chave: envio.chave, nome: 'lattes.pdf' });
    expect(res.status).toBe(400);
  });

  it('em "Meu perfil" o aluno troca o currículo e abre o próprio arquivo; docente não tem currículo', async () => {
    const auth = { Authorization: `Bearer ${(await cadastrar(container, aluno())).body.token as string}` };
    expect((await anexarCurriculo(container, auth, 'versao-1.pdf')).body.curriculo.nome).toBe('versao-1.pdf');
    expect((await anexarCurriculo(container, auth, 'versao-2.pdf')).body.curriculo.nome).toBe('versao-2.pdf');

    const link = await request(container.app).get('/api/perfil/curriculo').set(auth);
    expect(link.status).toBe(200);
    expect(link.body.nome).toBe('versao-2.pdf');
    expect((await request(container.app).get(link.body.url as string)).status).toBe(200);

    const docente = await cadastrar(container, {
      nome: 'Prof. Teste',
      email: 'prof.teste@unicap.br',
      senha: 'senha-segura-123',
      role: 'DOCENTE',
      departamento: 'DCC',
    });
    const negado = await request(container.app)
      .post('/api/perfil/curriculo/envio')
      .set('Authorization', `Bearer ${docente.body.token as string}`);
    expect(negado.status).toBe(403);
  });
});

describe('Envio de e-mail não configurado em produção', () => {
  it('o cadastro avisa (503) em vez de criar conta sem link de confirmação', async () => {
    const semEmail = buildTestApp({ jwtSecret: 'conta-secret', emailSender: new EmailIndisponivel() });
    const res = await request(semEmail.app).post('/api/auth/register').send(aluno());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(await semEmail.usuariosRepository.list()).toHaveLength(0);
  });
});

describe('Rota de e-mails de desenvolvimento', () => {
  it('mostra os links enviados quando não há servidor de e-mail (nunca em produção)', async () => {
    await request(container.app).post('/api/auth/register').send(aluno());
    const res = await request(container.app).get('/api/dev/emails');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ para: 'lucas.aluno@unicap.br', assunto: 'Confirme seu e-mail no Portal PIBIC' });
  });
});
