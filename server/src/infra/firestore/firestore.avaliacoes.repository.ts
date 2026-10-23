import type { Firestore, QueryDocumentSnapshot, QuerySnapshot } from 'firebase-admin/firestore';

import type { Avaliacao, AvaliacaoFiltro } from '../../modules/avaliacoes/domain/avaliacoes.types';
import {
  matchesAvaliacaoFiltro,
  type AvaliacoesRepository,
} from '../../modules/avaliacoes/repositories/avaliacoes.repository';

import { apagarColecao, COLECOES, ordenarPorData, paraDominio } from './firestore.helpers';

/** O operador `in` do Firestore aceita até 30 valores por consulta. */
const LIMITE_IN = 30;

/** Adapter Firestore da porta AvaliacoesRepository. As notas por critério ficam embutidas. */
export class FirestoreAvaliacoesRepository implements AvaliacoesRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.avaliacoes);
  }

  async create(avaliacao: Avaliacao): Promise<Avaliacao> {
    await this.colecao.doc(avaliacao.id).create(avaliacao);
    return clone(avaliacao);
  }

  async findById(id: string): Promise<Avaliacao | undefined> {
    const doc = await this.colecao.doc(id).get();
    return doc.exists ? paraDominio<Avaliacao>(doc.data()!) : undefined;
  }

  async list(filtro: AvaliacaoFiltro = {}): Promise<Avaliacao[]> {
    if (filtro.inscricaoIds && filtro.inscricaoIds.length === 0) return [];
    const docs = await this.buscar(filtro);
    return ordenarPorData(docs, (d) => paraDominio<Avaliacao>(d), (a) => a.atribuidaEm).filter((a) =>
      matchesAvaliacaoFiltro(a, filtro),
    );
  }

  private async buscar(filtro: AvaliacaoFiltro): Promise<QueryDocumentSnapshot[]> {
    if (filtro.inscricaoId) return dados(await this.colecao.where('inscricaoId', '==', filtro.inscricaoId).get());
    if (filtro.avaliadorId) return dados(await this.colecao.where('avaliadorId', '==', filtro.avaliadorId).get());
    if (filtro.inscricaoIds) {
      const ids = [...new Set(filtro.inscricaoIds)];
      const partes = await Promise.all(
        Array.from({ length: Math.ceil(ids.length / LIMITE_IN) }, (_, i) =>
          this.colecao.where('inscricaoId', 'in', ids.slice(i * LIMITE_IN, (i + 1) * LIMITE_IN)).get(),
        ),
      );
      return partes.flatMap(dados);
    }
    if (filtro.status) return dados(await this.colecao.where('status', '==', filtro.status).get());
    return dados(await this.colecao.get());
  }

  async update(avaliacao: Avaliacao): Promise<Avaliacao> {
    await this.colecao.doc(avaliacao.id).set(avaliacao);
    return clone(avaliacao);
  }

  async delete(id: string): Promise<void> {
    await this.colecao.doc(id).delete();
  }

  async clear(): Promise<void> {
    await apagarColecao(this.db, COLECOES.avaliacoes);
  }
}

function dados(snap: QuerySnapshot): QueryDocumentSnapshot[] {
  return snap.docs;
}

function clone(a: Avaliacao): Avaliacao {
  return { ...a, notas: a.notas.map((n) => ({ ...n })) };
}
