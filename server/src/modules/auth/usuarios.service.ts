import { NotFoundError, UnprocessableEntityError } from '@shared/errors/domain.errors';
import { isGestorRole, type UserRole } from '@shared/auth/auth.types';

import type { Usuario } from './domain/auth.types';
import type { UsuariosRepository } from './repositories/usuarios.repository';

export interface UpdateUsuarioInput {
  role?: UserRole;
  departamento?: string;
}

/**
 * Casos de uso de gestão de usuários (S1.2): listar contas e ajustar papel e
 * departamento. Restrito ao gestor pelas rotas; as regras abaixo evitam que a
 * gestão perca o acesso por engano.
 */
export class UsuariosService {
  constructor(private readonly usuarios: UsuariosRepository) {}

  list(role?: UserRole): Promise<Usuario[]> {
    return this.usuarios.list(role);
  }

  async getById(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.findById(id);
    if (!usuario) {
      throw new NotFoundError(`Usuário ${id} não encontrado.`);
    }
    return usuario;
  }

  async update(actorId: string, id: string, input: UpdateUsuarioInput): Promise<Usuario> {
    const usuario = await this.getById(id);

    if (input.role && input.role !== usuario.role) {
      if (actorId === id) {
        throw new UnprocessableEntityError(
          'Você não pode alterar o seu próprio papel. Peça a outro gestor.',
        );
      }
      if (isGestorRole(usuario.role) && !isGestorRole(input.role)) {
        const gestores = (await this.usuarios.list()).filter((u) => isGestorRole(u.role));
        if (gestores.length <= 1) {
          throw new UnprocessableEntityError(
            'O portal precisa de ao menos um gestor. Promova outra pessoa antes de alterar este papel.',
          );
        }
      }
    }

    return this.usuarios.update({
      ...usuario,
      role: input.role ?? usuario.role,
      departamento:
        input.departamento !== undefined ? input.departamento.trim().toUpperCase() : usuario.departamento,
    });
  }
}
