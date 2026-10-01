import type { Avaliacao, AvaliacaoFiltro } from '../domain/avaliacoes.types';

export interface AvaliacoesRepository {
  create(avaliacao: Avaliacao): Promise<Avaliacao>;
  findById(id: string): Promise<Avaliacao | undefined>;
  list(filtro?: AvaliacaoFiltro): Promise<Avaliacao[]>;
  update(avaliacao: Avaliacao): Promise<Avaliacao>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function matchesAvaliacaoFiltro(a: Avaliacao, filtro: AvaliacaoFiltro = {}): boolean {
  return (
    (!filtro.inscricaoId || a.inscricaoId === filtro.inscricaoId) &&
    (!filtro.inscricaoIds || filtro.inscricaoIds.includes(a.inscricaoId)) &&
    (!filtro.avaliadorId || a.avaliadorId === filtro.avaliadorId) &&
    (!filtro.status || a.status === filtro.status)
  );
}

function clone(a: Avaliacao): Avaliacao {
  return { ...a, notas: a.notas.map((n) => ({ ...n })) };
}

export class InMemoryAvaliacoesRepository implements AvaliacoesRepository {
  private readonly store = new Map<string, Avaliacao>();

  async create(avaliacao: Avaliacao): Promise<Avaliacao> {
    this.store.set(avaliacao.id, clone(avaliacao));
    return clone(avaliacao);
  }

  async findById(id: string): Promise<Avaliacao | undefined> {
    const found = this.store.get(id);
    return found ? clone(found) : undefined;
  }

  async list(filtro?: AvaliacaoFiltro): Promise<Avaliacao[]> {
    return [...this.store.values()]
      .filter((a) => matchesAvaliacaoFiltro(a, filtro))
      .sort((a, b) => a.atribuidaEm.getTime() - b.atribuidaEm.getTime())
      .map(clone);
  }

  async update(avaliacao: Avaliacao): Promise<Avaliacao> {
    this.store.set(avaliacao.id, clone(avaliacao));
    return clone(avaliacao);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
