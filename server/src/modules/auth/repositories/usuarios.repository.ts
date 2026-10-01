import type { UserRole } from '@shared/auth/auth.types';

import type { Usuario } from '../domain/auth.types';

/**
 * Porta do repositório de usuários (hexagonal).
 * Implementações: in-memory (testes) e Prisma/SQLite (produção — infra/persistence).
 */
export interface UsuariosRepository {
  create(usuario: Usuario): Promise<Usuario>;
  findByEmail(email: string): Promise<Usuario | undefined>;
  findById(id: string): Promise<Usuario | undefined>;
  findManyByIds(ids: readonly string[]): Promise<Usuario[]>;
  list(role?: UserRole): Promise<Usuario[]>;
  update(usuario: Usuario): Promise<Usuario>;
  /** Limpa o repositório — usado pelos testes entre cenários. */
  clear(): Promise<void>;
}

/** Implementação em memória — determinística para testes unitários. */
export class InMemoryUsuariosRepository implements UsuariosRepository {
  private readonly store = new Map<string, Usuario>();

  async create(usuario: Usuario): Promise<Usuario> {
    this.store.set(usuario.id, { ...usuario });
    return { ...usuario };
  }

  async findByEmail(email: string): Promise<Usuario | undefined> {
    const normalized = email.trim().toLowerCase();
    const found = [...this.store.values()].find((u) => u.email.toLowerCase() === normalized);
    return found ? { ...found } : undefined;
  }

  async findById(id: string): Promise<Usuario | undefined> {
    const found = this.store.get(id);
    return found ? { ...found } : undefined;
  }

  async findManyByIds(ids: readonly string[]): Promise<Usuario[]> {
    return ids.flatMap((id) => {
      const found = this.store.get(id);
      return found ? [{ ...found }] : [];
    });
  }

  async list(role?: UserRole): Promise<Usuario[]> {
    return [...this.store.values()]
      .filter((u) => !role || u.role === role)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((u) => ({ ...u }));
  }

  async update(usuario: Usuario): Promise<Usuario> {
    this.store.set(usuario.id, { ...usuario });
    return { ...usuario };
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
