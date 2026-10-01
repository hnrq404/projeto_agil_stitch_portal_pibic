import type { Relatorio } from '../domain/projetos.types';

export interface RelatoriosRepository {
  create(relatorio: Relatorio): Promise<Relatorio>;
  findById(id: string): Promise<Relatorio | undefined>;
  listByInscricao(inscricaoId: string): Promise<Relatorio[]>;
  list(): Promise<Relatorio[]>;
  update(relatorio: Relatorio): Promise<Relatorio>;
  clear(): Promise<void>;
}

export class InMemoryRelatoriosRepository implements RelatoriosRepository {
  private readonly store = new Map<string, Relatorio>();

  async create(relatorio: Relatorio): Promise<Relatorio> {
    this.store.set(relatorio.id, { ...relatorio });
    return { ...relatorio };
  }

  async findById(id: string): Promise<Relatorio | undefined> {
    const found = this.store.get(id);
    return found ? { ...found } : undefined;
  }

  async listByInscricao(inscricaoId: string): Promise<Relatorio[]> {
    return (await this.list()).filter((r) => r.inscricaoId === inscricaoId);
  }

  async list(): Promise<Relatorio[]> {
    return [...this.store.values()]
      .sort((a, b) => a.enviadoEm.getTime() - b.enviadoEm.getTime())
      .map((r) => ({ ...r }));
  }

  async update(relatorio: Relatorio): Promise<Relatorio> {
    this.store.set(relatorio.id, { ...relatorio });
    return { ...relatorio };
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
