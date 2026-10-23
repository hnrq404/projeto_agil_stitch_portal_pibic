import type { Firestore } from 'firebase-admin/firestore';

import { NotFoundError } from '../../shared/errors/domain.errors';
import type { Notificacao } from '../../modules/notificacoes/domain/notificacoes.types';
import type { NotificacoesRepository } from '../../modules/notificacoes/repositories/notificacoes.repository';

import { apagarColecao, COLECOES, emLotes, ordenarPorData, paraDominio } from './firestore.helpers';

/**
 * Adapter Firestore da porta NotificacoesRepository. A contagem do sino usa
 * `count()` (cobra uma leitura a cada mil, não uma por notificação) e o índice
 * composto userId + lida declarado em firestore.indexes.json.
 */
export class FirestoreNotificacoesRepository implements NotificacoesRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.notificacoes);
  }

  private naoLidas(userId: string) {
    return this.colecao.where('userId', '==', userId).where('lida', '==', false);
  }

  async create(notificacao: Notificacao): Promise<Notificacao> {
    await this.colecao.doc(notificacao.id).set(notificacao);
    return { ...notificacao };
  }

  async listByUser(userId: string, onlyUnread = false): Promise<Notificacao[]> {
    const snap = await (onlyUnread ? this.naoLidas(userId) : this.colecao.where('userId', '==', userId)).get();
    return ordenarPorData(snap.docs, (d) => paraDominio<Notificacao>(d), (n) => n.criadoEm, 'desc');
  }

  async createMany(notificacoes: readonly Notificacao[]): Promise<void> {
    for (const lote of emLotes(notificacoes)) {
      const batch = this.db.batch();
      lote.forEach((n) => batch.set(this.colecao.doc(n.id), n));
      await batch.commit();
    }
  }

  async listUserIdsNotificados(tipo: Notificacao['tipo'], referenceId: string): Promise<string[]> {
    const snap = await this.colecao.where('referenceId', '==', referenceId).get();
    return snap.docs.map((d) => d.data()).filter((d) => d['tipo'] === tipo).map((d) => d['userId'] as string);
  }

  async countUnread(userId: string): Promise<number> {
    const snap = await this.naoLidas(userId).count().get();
    return snap.data().count;
  }

  async markAsRead(userId: string, notificacaoId: string): Promise<Notificacao> {
    const ref = this.colecao.doc(notificacaoId);
    return this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      // Confere o dono antes de gravar: nunca altera notificação de outro usuário.
      if (!doc.exists || doc.data()?.['userId'] !== userId) {
        throw new NotFoundError('Notificação não encontrada para este usuário.');
      }
      tx.update(ref, { lida: true });
      return { ...paraDominio<Notificacao>(doc.data()!), lida: true };
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const snap = await this.naoLidas(userId).get();
    for (const lote of emLotes(snap.docs)) {
      const batch = this.db.batch();
      lote.forEach((d) => batch.update(d.ref, { lida: true }));
      await batch.commit();
    }
    return snap.size;
  }

  async clear(): Promise<void> {
    await apagarColecao(this.db, COLECOES.notificacoes);
  }
}
