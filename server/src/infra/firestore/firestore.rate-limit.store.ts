import { createHash } from 'node:crypto';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import type { JanelaDeTentativas, RateLimitStore } from '../../shared/http/security.middleware';

import { COLECOES } from './firestore.helpers';

/**
 * Contadores do limite de tentativas no Firestore, compartilhados entre as
 * instâncias da função na Vercel. O id do documento é um hash da chave, para o
 * IP do usuário não ficar legível no banco. O campo `expiraEm` permite ligar
 * uma política de TTL na coleção e o Firestore apagar as janelas vencidas sozinho.
 *
 * Cada janela de tempo tem o seu documento (o número da janela entra no id) e a
 * soma usa o incremento atômico do Firestore, sem transação. Antes era uma
 * transação de leitura e escrita no mesmo documento: com logins simultâneos ela
 * travava ("Transaction lock timeout"), um login certo chegava a 12 s e, ao
 * expirar, o limite era liberado (teste de estresse, testes-finais/).
 */
export function createFirestoreRateLimitStore(db: Firestore): RateLimitStore {
  function janela(chave: string, agora: number, windowMs: number) {
    const numero = Math.floor(agora / windowMs);
    const resetAt = (numero + 1) * windowMs;
    const id = createHash('sha256').update(`${chave}:${windowMs}:${numero}`).digest('hex');
    return { ref: db.collection(COLECOES.limitesTentativa).doc(id), resetAt };
  }

  async function contagem(ref: FirebaseFirestore.DocumentReference): Promise<number> {
    const dados = (await ref.get()).data() as Partial<JanelaDeTentativas> | undefined;
    return Math.max(0, dados?.count ?? 0);
  }

  return {
    async consultar(chave, agora, windowMs) {
      const { ref, resetAt } = janela(chave, agora, windowMs);
      return { count: await contagem(ref), resetAt };
    },

    async incrementar(chave, agora, windowMs) {
      const { ref, resetAt } = janela(chave, agora, windowMs);
      await ref.set({ count: FieldValue.increment(1), resetAt, expiraEm: new Date(resetAt) }, { merge: true });
      // Lida depois da soma: inclui a própria tentativa e as que chegaram junto.
      return { count: await contagem(ref), resetAt };
    },

    async decrementar(chave, agora, windowMs) {
      const { ref } = janela(chave, agora, windowMs);
      await ref.set({ count: FieldValue.increment(-1) }, { merge: true });
    },
  };
}
