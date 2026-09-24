import type { Notificacao } from '../domain/notificacoes.types';

export interface NotificacoesRepository {
  create(notificacao: Notificacao): Promise<Notificacao>;
  listByUser(userId: string, onlyUnread?: boolean): Promise<Notificacao[]>;
  markAsRead(userId: string, notificacaoId: string): Promise<Notificacao>;
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

  async markAsRead(userId: string, notificacaoId: string): Promise<Notificacao> {
    const found = this.store.get(notificacaoId);
    if (!found || found.userId !== userId) {
      return Promise.reject(new Error('Notificação não encontrada para este usuário.'));
    }
    const updated: Notificacao = { ...found, lida: true };
    this.store.set(notificacaoId, updated);
    return { ...updated };
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
