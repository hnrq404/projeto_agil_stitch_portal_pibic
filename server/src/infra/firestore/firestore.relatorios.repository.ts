import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { ConflictError } from '../../shared/errors/domain.errors';
import type { Relatorio } from '../../modules/projetos/domain/projetos.types';
import type { RelatoriosRepository } from '../../modules/projetos/repositories/relatorios.repository';

import { apagarColecao, COLECOES, idSeguro, jaExiste, ordenarPorData, paraDominio } from './firestore.helpers';

const LIMITE_IN = 30;

/**
 * Adapter Firestore da porta RelatoriosRepository. A combinação projeto + tipo +
 * mês + versão é única: dois envios simultâneos não geram a mesma versão.
 */
export class FirestoreRelatoriosRepository implements RelatoriosRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.relatorios);
  }

  async create(relatorio: Relatorio): Promise<Relatorio> {
    const chave = idSeguro(relatorio.inscricaoId, relatorio.tipo, relatorio.competencia || '-', String(relatorio.versao));
    const batch = this.db.batch();
    batch.create(this.db.collection(COLECOES.relatoriosVersoes).doc(chave), { relatorioId: relatorio.id });
    batch.create(this.colecao.doc(relatorio.id), relatorio);
    try {
      await batch.commit();
    } catch (error) {
      if (jaExiste(error)) throw new ConflictError('Esta versão do relatório acabou de ser enviada. Atualize a página.');
      throw error;
    }
    return clone(relatorio);
  }

  async findById(id: string): Promise<Relatorio | undefined> {
    const doc = await this.colecao.doc(id).get();
    return doc.exists ? toDomain(doc.data()!) : undefined;
  }

  async listByInscricao(inscricaoId: string): Promise<Relatorio[]> {
    const snap = await this.colecao.where('inscricaoId', '==', inscricaoId).get();
    return ordenarPorData(snap.docs, toDomain, (r) => r.enviadoEm);
  }

  async list(filtro: { inscricaoIds?: readonly string[] } = {}): Promise<Relatorio[]> {
    let docs: QueryDocumentSnapshot[];
    if (filtro.inscricaoIds) {
      const ids = [...new Set(filtro.inscricaoIds)];
      const partes = await Promise.all(
        Array.from({ length: Math.ceil(ids.length / LIMITE_IN) }, (_, i) =>
          this.colecao.where('inscricaoId', 'in', ids.slice(i * LIMITE_IN, (i + 1) * LIMITE_IN)).get(),
        ),
      );
      docs = partes.flatMap((p) => p.docs);
    } else {
      docs = (await this.colecao.get()).docs;
    }
    return ordenarPorData(docs, toDomain, (r) => r.enviadoEm);
  }

  async update(relatorio: Relatorio): Promise<Relatorio> {
    await this.colecao.doc(relatorio.id).set(relatorio);
    return clone(relatorio);
  }

  async clear(): Promise<void> {
    await apagarColecao(this.db, COLECOES.relatorios);
    await apagarColecao(this.db, COLECOES.relatoriosVersoes);
  }
}

function toDomain(data: FirebaseFirestore.DocumentData): Relatorio {
  const relatorio = paraDominio<Relatorio>(data);
  return { ...relatorio, arquivo: relatorio.arquivo ?? null };
}

function clone(relatorio: Relatorio): Relatorio {
  return { ...relatorio, arquivo: relatorio.arquivo ? { ...relatorio.arquivo } : null };
}
