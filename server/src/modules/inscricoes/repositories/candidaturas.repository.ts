import type { Candidatura, CandidaturaFiltro } from '../domain/inscricoes.types';

/** Porta do repositório de candidaturas dos alunos aos projetos divulgados. */
export interface CandidaturasRepository {
  create(candidatura: Candidatura): Promise<Candidatura>;
  findById(id: string): Promise<Candidatura | undefined>;
  findByInscricaoAndDiscente(inscricaoId: string, discenteId: string): Promise<Candidatura | undefined>;
  list(filtro?: CandidaturaFiltro): Promise<Candidatura[]>;
  update(candidatura: Candidatura): Promise<Candidatura>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function matchesCandidaturaFiltro(c: Candidatura, filtro: CandidaturaFiltro = {}): boolean {
  return (
    (!filtro.inscricaoId || c.inscricaoId === filtro.inscricaoId) &&
    (!filtro.discenteId || c.discenteId === filtro.discenteId) &&
    (!filtro.status || c.status === filtro.status)
  );
}

export class InMemoryCandidaturasRepository implements CandidaturasRepository {
  private readonly store = new Map<string, Candidatura>();

  async create(candidatura: Candidatura): Promise<Candidatura> {
    this.store.set(candidatura.id, { ...candidatura });
    return { ...candidatura };
  }

  async findById(id: string): Promise<Candidatura | undefined> {
    const found = this.store.get(id);
    return found ? { ...found } : undefined;
  }

  async findByInscricaoAndDiscente(inscricaoId: string, discenteId: string): Promise<Candidatura | undefined> {
    const found = [...this.store.values()].find(
      (c) => c.inscricaoId === inscricaoId && c.discenteId === discenteId,
    );
    return found ? { ...found } : undefined;
  }

  async list(filtro?: CandidaturaFiltro): Promise<Candidatura[]> {
    return [...this.store.values()]
      .filter((c) => matchesCandidaturaFiltro(c, filtro))
      .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
      .map((c) => ({ ...c }));
  }

  async update(candidatura: Candidatura): Promise<Candidatura> {
    this.store.set(candidatura.id, { ...candidatura });
    return { ...candidatura };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
