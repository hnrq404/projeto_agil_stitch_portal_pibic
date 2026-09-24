import type { Edital } from '../domain/editais.types';

/**
 * Porta do repositório de editais (hexagonal).
 * A implementação padrão é in-memory (usada em dev, CI e testes); para trocar por
 * PostgreSQL/Prisma, implemente esta interface com as mesmas assinaturas.
 */
export interface EditaisRepository {
  create(edital: Edital): Promise<Edital>;
  findById(id: string): Promise<Edital | undefined>;
  findByNumero(numero: string): Promise<Edital | undefined>;
  /** Lista todos, opcionalmente filtrando por status. */
  list(status?: EditalStatusFilter): Promise<Edital[]>;
  update(edital: Edital): Promise<Edital>;
  /** Limpa o repositório — usado pelos testes E2E entre cenários. */
  clear(): Promise<void>;
}

export type EditalStatusFilter = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO' | undefined;

/** Implementação em memória — zero dependências externas, determinística para testes. */
export class InMemoryEditaisRepository implements EditaisRepository {
  private readonly store = new Map<string, Edital>();

  async create(edital: Edital): Promise<Edital> {
    this.store.set(edital.id, { ...edital, cotas: edital.cotas.map((cota) => ({ ...cota })) });
    return this.findById(edital.id) as Promise<Edital>;
  }

  async findById(id: string): Promise<Edital | undefined> {
    const found = this.store.get(id);
    return found ? { ...found, cotas: found.cotas.map((c) => ({ ...c })) } : undefined;
  }

  async findByNumero(numero: string): Promise<Edital | undefined> {
    const found = [...this.store.values()].find((edital) => edital.numero === numero);
    return found ? { ...found, cotas: found.cotas.map((c) => ({ ...c })) } : undefined;
  }

  async list(status?: EditalStatusFilter): Promise<Edital[]> {
    const all = [...this.store.values()]
      .filter((edital) => !status || edital.status === status)
      .map((edital) => ({ ...edital, cotas: edital.cotas.map((c) => ({ ...c })) }));
    return all.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
    // Ordenação: mais recentes primeiro (útil para painéis administrativos).
  }

  async update(edital: Edital): Promise<Edital> {
    this.store.set(edital.id, { ...edital, cotas: edital.cotas.map((cota) => ({ ...cota })) });
    return this.findById(edital.id) as Promise<Edital>;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
