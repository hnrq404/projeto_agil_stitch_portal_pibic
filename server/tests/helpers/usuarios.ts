import { randomUUID } from 'node:crypto';

import request from 'supertest';

import { AuthService } from '../../src/modules/auth/auth.service';
import type { Usuario } from '../../src/modules/auth/domain/auth.types';
import type { AppContainer } from '../../src/infra/config/app.container';
import type { UserRole } from '../../src/shared/auth/auth.types';

export interface NovoUsuario {
  nome: string;
  email: string;
  senha?: string;
  role: UserRole;
  departamento?: string;
  matricula?: string;
}

/**
 * Cria a conta direto no repositório, como faz o seed. Papéis como GESTOR e
 * AVALIADOR não podem ser obtidos pelo auto-cadastro.
 */
export async function criarUsuario(container: AppContainer, input: NovoUsuario): Promise<Usuario> {
  return container.usuariosRepository.create({
    id: randomUUID(),
    nome: input.nome,
    email: input.email.toLowerCase(),
    senhaHash: await AuthService.hashSenha(input.senha ?? 'senha123'),
    role: input.role,
    departamento: input.departamento ?? '',
    matricula: input.matricula ?? null,
    criadoEm: new Date(),
  });
}

/** Cria a conta e devolve o header Authorization com um JWT real. */
export async function criarELogar(
  container: AppContainer,
  input: NovoUsuario,
): Promise<{ usuario: Usuario; auth: { Authorization: string } }> {
  const usuario = await criarUsuario(container, input);
  const res = await request(container.app)
    .post('/api/auth/login')
    .send({ email: input.email, senha: input.senha ?? 'senha123' });
  if (res.status !== 200) {
    throw new Error(`Login falhou para ${input.email}: ${res.status}`);
  }
  return { usuario, auth: { Authorization: `Bearer ${res.body.token as string}` } };
}
