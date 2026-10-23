import { createHash } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';

import type { JanelaDeTentativas, RateLimitStore } from '../../shared/http/security.middleware';

import { COLECOES } from './firestore.helpers';

/**
 * Contadores do limite de tentativas no Firestore, compartilhados entre as
 * instâncias da função na Vercel. O id do documento é um hash da chave, para o
 * IP do usuário não ficar legível no banco. O campo `expiraEm` permite ligar
 * uma política de TTL na coleção e o Firestore apagar as janelas vencidas sozinho.
 */
export function createFirestoreRateLimitStore(db: Firestore): RateLimitStore {
  const ref = (chave: string) =>
    db.collection(COLECOES.limitesTentativa).doc(createHash('sha256').update(chave).digest('hex'));

  return {
    async consultar(chave, agora) {
      const doc = await ref(chave).get();
      const janela = doc.data() as JanelaDeTentativas | undefined;
      return janela && janela.resetAt > agora ? { count: janela.count, resetAt: janela.resetAt } : { count: 0, resetAt: agora };
    },

    async incrementar(chave, agora, windowMs) {
      const docRef = ref(chave);
      return db.runTransaction(async (tx) => {
        const atual = (await tx.get(docRef)).data() as JanelaDeTentativas | undefined;
        const janela =
          atual && atual.resetAt > agora
            ? { count: atual.count + 1, resetAt: atual.resetAt }
            : { count: 1, resetAt: agora + windowMs };
        tx.set(docRef, { ...janela, expiraEm: new Date(janela.resetAt) });
        return janela;
      });
    },
  };
}
