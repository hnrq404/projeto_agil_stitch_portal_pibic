import type { Inscricao, InscricaoFiltro } from '../domain/inscricoes.types';

/**
 * Porta do repositório de inscrições (hexagonal). Os anexos fazem parte do
 * agregado: `update` substitui o conjunto, como as cotas no edital.
 */
export interface InscricoesRepository {
  create(inscricao: Inscricao): Promise<Inscricao>;
  findById(id: string): Promise<Inscricao | undefined>;
  findByEditalAndDiscente(editalId: string, discenteId: string): Promise<Inscricao | undefined>;
  list(filtro?: InscricaoFiltro): Promise<Inscricao[]>;
  update(inscricao: Inscricao): Promise<Inscricao>;
  /** Quantidade de protocolos já emitidos no ano (base do sequencial). */
  countProtocolosNoAno(ano: number): Promise<number>;
  clear(): Promise<void>;
}

export function matchesFiltro(inscricao: Inscricao, filtro: InscricaoFiltro = {}): boolean {
  return (
    (!filtro.editalId || inscricao.editalId === filtro.editalId) &&
    (!filtro.discenteId || inscricao.discenteId === filtro.discenteId) &&
    (!filtro.orientadorId || inscricao.orientadorId === filtro.orientadorId) &&
    (!filtro.subareaCode || inscricao.subareaCode === filtro.subareaCode) &&
    (!filtro.status?.length || filtro.status.includes(inscricao.status))
  );
}

function clone(inscricao: Inscricao): Inscricao {
  return { ...inscricao, anexos: inscricao.anexos.map((a) => ({ ...a })) };
}

export class InMemoryInscricoesRepository implements InscricoesRepository {
  private readonly store = new Map<string, Inscricao>();

  async create(inscricao: Inscricao): Promise<Inscricao> {
    this.store.set(inscricao.id, clone(inscricao));
    return clone(inscricao);
  }

  async findById(id: string): Promise<Inscricao | undefined> {
    const found = this.store.get(id);
    return found ? clone(found) : undefined;
  }

  async findByEditalAndDiscente(editalId: string, discenteId: string): Promise<Inscricao | undefined> {
    const found = [...this.store.values()].find(
      (i) => i.editalId === editalId && i.discenteId === discenteId,
    );
    return found ? clone(found) : undefined;
  }

  async list(filtro?: InscricaoFiltro): Promise<Inscricao[]> {
    return [...this.store.values()]
      .filter((i) => matchesFiltro(i, filtro))
      .sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime())
      .map(clone);
  }

  async update(inscricao: Inscricao): Promise<Inscricao> {
    this.store.set(inscricao.id, clone(inscricao));
    return clone(inscricao);
  }

  async countProtocolosNoAno(ano: number): Promise<number> {
    return [...this.store.values()].filter((i) => i.protocolo?.includes(`/${ano}-`)).length;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
