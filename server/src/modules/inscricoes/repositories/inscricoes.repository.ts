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
  /** Reserva atomicamente o próximo sequencial de protocolo do ano (nunca repete, mesmo com envios simultâneos). */
  proximoSequencialProtocolo(ano: number): Promise<number>;
  /**
   * Grava a inscrição APROVADA só se a subárea ainda tiver cota, numa única
   * transação: dois gestores homologando ao mesmo tempo não estouram a cota.
   * `aprovadas` não conta a própria inscrição; `salva` vem vazio quando a cota acabou.
   */
  aprovarDentroDaCota(inscricao: Inscricao, limite: number): Promise<AprovacaoResultado>;
  clear(): Promise<void>;
}

export interface AprovacaoResultado {
  aprovadas: number;
  salva?: Inscricao;
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

  private readonly sequencias = new Map<number, number>();

  async proximoSequencialProtocolo(ano: number): Promise<number> {
    const proximo = (this.sequencias.get(ano) ?? 0) + 1;
    this.sequencias.set(ano, proximo);
    return proximo;
  }

  async aprovarDentroDaCota(inscricao: Inscricao, limite: number): Promise<AprovacaoResultado> {
    // Sem await entre a contagem e a gravação: atômico no event loop.
    const aprovadas = [...this.store.values()].filter(
      (i) =>
        i.id !== inscricao.id &&
        i.editalId === inscricao.editalId &&
        i.subareaCode === inscricao.subareaCode &&
        i.status === 'APROVADA',
    ).length;
    if (aprovadas >= limite) return { aprovadas };
    this.store.set(inscricao.id, clone(inscricao));
    return { aprovadas, salva: clone(inscricao) };
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.sequencias.clear();
  }
}
