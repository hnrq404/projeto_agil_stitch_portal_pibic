import request from 'supertest';

import type { AppContainer } from '../../src/infra/config/app.container';
import { MemoryEmailSender } from '../../src/shared/email/email.sender';

/** Token do link mais recente enviado a este e-mail (o teste "abre a caixa de entrada"). */
export function tokenDoUltimoEmail(container: AppContainer, para: string): string {
  const sender = container.emailSender;
  if (!(sender instanceof MemoryEmailSender)) throw new Error('Os testes esperam o envio de e-mail em memória.');
  const email = [...sender.enviados].reverse().find((e) => e.para === para.trim().toLowerCase());
  const token = email?.texto.match(/token=(\S+)/)?.[1];
  if (!token) throw new Error(`Nenhum link enviado para ${para}.`);
  return decodeURIComponent(token);
}

/**
 * Cadastro completo como a pessoa faz: cria a conta, abre o e-mail e clica no
 * link. Devolve a resposta da confirmação ({ token, usuario }) ou a do cadastro
 * se ele falhar.
 */
export async function cadastrar(container: AppContainer, payload: { email: string } & Record<string, unknown>) {
  const cadastro = await request(container.app).post('/api/auth/register').send(payload);
  if (cadastro.status !== 201) return cadastro;
  return request(container.app)
    .post('/api/auth/verificar-email')
    .send({ token: tokenDoUltimoEmail(container, payload.email) });
}

/** Aluno com o Lattes no perfil (exigido para se candidatar), pelo mesmo fluxo do site. */
export async function anexarCurriculo(container: AppContainer, auth: { Authorization: string }, nome = 'lattes.pdf') {
  const envio = await request(container.app).post('/api/perfil/curriculo/envio').set(auth);
  if (envio.status !== 200) return envio;
  await request(container.app)
    .put(envio.body.upload.url as string)
    .set('Content-Type', 'application/pdf')
    .send(Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'));
  return request(container.app).put('/api/perfil/curriculo').set(auth).send({ chave: envio.body.chave as string, nome });
}
