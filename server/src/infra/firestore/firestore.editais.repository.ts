import type { Firestore } from 'firebase-admin/firestore';

import { ConflictError } from '../../shared/errors/domain.errors';
import type { Edital } from '../../modules/editais/domain/editais.types';
import type {
  EditaisRepository,
  EditalStatusFilter,
} from '../../modules/editais/repositories/editais.repository';

import { apagarColecao, COLECOES, idSeguro, jaExiste, ordenarPorData, paraDominio } from './firestore.helpers';

/** Adapter Firestore da porta EditaisRepository. As cotas ficam embutidas no documento do edital. */
export class FirestoreEditaisRepository implements EditaisRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.editais);
  }

  private indiceNumero(numero: string) {
    return this.db.collection(COLECOES.editaisNumeros).doc(idSeguro(numero));
  }

  async create(edital: Edital): Promise<Edital> {
    const batch = this.db.batch();
    batch.create(this.indiceNumero(edital.numero), { editalId: edital.id });
    batch.create(this.colecao.doc(edital.id), edital);
    await commitOuConflito(() => batch.commit(), edital.numero);
    return clone(edital);
  }

  async findById(id: string): Promise<Edital | undefined> {
    const doc = await this.colecao.doc(id).get();
    return doc.exists ? paraDominio<Edital>(doc.data()!) : undefined;
  }

  async findByNumero(numero: string): Promise<Edital | undefined> {
    const snap = await this.colecao.where('numero', '==', numero).limit(1).get();
    const doc = snap.docs[0];
    return doc ? paraDominio<Edital>(doc.data()) : undefined;
  }

  async list(status?: EditalStatusFilter): Promise<Edital[]> {
    const snap = status ? await this.colecao.where('status', '==', status).get() : await this.colecao.get();
    return ordenarPorData(snap.docs, (d) => paraDominio<Edital>(d), (e) => e.criadoEm, 'desc');
  }

  async update(edital: Edital): Promise<Edital> {
    // Edital e cotas são um documento só: a troca das cotas é atômica por natureza.
    await commitOuConflito(
      () =>
        this.db.runTransaction(async (tx) => {
          const atual = await tx.get(this.colecao.doc(edital.id));
          const numeroAnterior = atual.data()?.['numero'] as string | undefined;
          if (numeroAnterior !== undefined && numeroAnterior !== edital.numero) {
            tx.delete(this.indiceNumero(numeroAnterior));
            tx.create(this.indiceNumero(edital.numero), { editalId: edital.id });
          }
          tx.set(this.colecao.doc(edital.id), edital);
        }),
      edital.numero,
    );
    return clone(edital);
  }

  async clear(): Promise<void> {
    await apagarColecao(this.db, COLECOES.editais);
    await apagarColecao(this.db, COLECOES.editaisNumeros);
  }
}

async function commitOuConflito(commit: () => Promise<unknown>, numero: string): Promise<void> {
  try {
    await commit();
  } catch (error) {
    if (jaExiste(error)) throw new ConflictError(`Já existe um edital com o número ${numero}.`, { numero });
    throw error;
  }
}

function clone(edital: Edital): Edital {
  return { ...edital, cotas: edital.cotas.map((c) => ({ ...c })) };
}
