import type { FiltroAuditoria, RegistroAuditoria } from '../domain/auditoria.types';

/**
 * Porta do repositório da trilha de auditoria (hexagonal).
 * Implementações: in-memory (testes) e Prisma/SQLite (infra/persistence).
 */
export interface AuditoriaRepository {
  create(registro: RegistroAuditoria): Promise<void>;
  /** Registros que casam com o filtro, do mais recente para o mais antigo, e o total sem o limite. */
  list(filtro: FiltroAuditoria): Promise<{ data: RegistroAuditoria[]; total: number }>;
}

export class InMemoryAuditoriaRepository implements AuditoriaRepository {
  private readonly store: RegistroAuditoria[] = [];

  async create(registro: RegistroAuditoria): Promise<void> {
    this.store.push({ ...registro, detalhes: { ...registro.detalhes } });
  }

  async list(filtro: FiltroAuditoria): Promise<{ data: RegistroAuditoria[]; total: number }> {
    const encontrados = this.store
      .filter(
        (r) =>
          (!filtro.entidade || r.entidade === filtro.entidade) &&
          (!filtro.entidadeId || r.entidadeId === filtro.entidadeId) &&
          (!filtro.actorId || r.actorId === filtro.actorId),
      )
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
    return { data: encontrados.slice(0, filtro.limite).map((r) => ({ ...r })), total: encontrados.length };
  }
}
