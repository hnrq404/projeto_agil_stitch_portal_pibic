import type { Usuario } from '../domain/auth.types';

/**
 * Porta do repositório de usuários (hexagonal).
 * Implementações: in-memory (testes) e Prisma/SQLite (produção — infra/persistence).
 */
export interface UsuariosRepository {
  create(usuario: Usuario): Promise<Usuario>;
  findByEmail(email: string): Promise<Usuario | undefined>;
  findById(id: string): Promise<Usuario | undefined>;
  list(): Promise<Usuario[]>;
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

  async list(): Promise<Usuario[]> {
    return [...this.store.values()].map((u) => ({ ...u }));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
