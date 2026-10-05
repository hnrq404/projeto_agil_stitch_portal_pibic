import { NotFoundError } from '@shared/errors/domain.errors';

import type { Notificacao } from '../domain/notificacoes.types';

export interface NotificacoesRepository {
  create(notificacao: Notificacao): Promise<Notificacao>;
  listByUser(userId: string, onlyUnread?: boolean): Promise<Notificacao[]>;
  /** Grava várias notificações de uma vez (broadcast). */
  createMany(notificacoes: readonly Notificacao[]): Promise<void>;
  /** Usuários que já receberam uma notificação deste tipo para a referência (idempotência do broadcast). */
  listUserIdsNotificados(tipo: Notificacao['tipo'], referenceId: string): Promise<string[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(userId: string, notificacaoId: string): Promise<Notificacao>;
  /** Marca todas as não lidas do usuário numa única escrita; devolve quantas mudaram. */
  markAllAsRead(userId: string): Promise<number>;
  /** Limpa o repositório — usado pelos testes E2E entre cenários. */
  clear(): Promise<void>;
}

export class InMemoryNotificacoesRepository implements NotificacoesRepository {
  private readonly store = new Map<string, Notificacao>();

  async create(notificacao: Notificacao): Promise<Notificacao> {
    this.store.set(notificacao.id, { ...notificacao });
    return { ...notificacao };
  }

  async listByUser(userId: string, onlyUnread = false): Promise<Notificacao[]> {
    return [...this.store.values()]
      .filter((n) => n.userId === userId && (!onlyUnread || !n.lida))
      .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  }

  async createMany(notificacoes: readonly Notificacao[]): Promise<void> {
    for (const n of notificacoes) this.store.set(n.id, { ...n });
  }

  async listUserIdsNotificados(tipo: Notificacao['tipo'], referenceId: string): Promise<string[]> {
    return [...this.store.values()]
      .filter((n) => n.tipo === tipo && n.referenceId === referenceId)
      .map((n) => n.userId);
  }

  async countUnread(userId: string): Promise<number> {
    return [...this.store.values()].filter((n) => n.userId === userId && !n.lida).length;
  }

  async markAllAsRead(userId: string): Promise<number> {
    let count = 0;
    for (const [id, n] of this.store) {
      if (n.userId === userId && !n.lida) {
        this.store.set(id, { ...n, lida: true });
        count += 1;
      }
    }
    return count;
  }

  async markAsRead(userId: string, notificacaoId: string): Promise<Notificacao> {
    const found = this.store.get(notificacaoId);
    if (!found || found.userId !== userId) {
      throw new NotFoundError('Notificação não encontrada para este usuário.');
    }
    const updated: Notificacao = { ...found, lida: true };
    this.store.set(notificacaoId, updated);
    return { ...updated };
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
