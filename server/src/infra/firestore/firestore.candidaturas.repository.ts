import type { Firestore } from 'firebase-admin/firestore';

import { ConflictError } from '../../shared/errors/domain.errors';
import type { Candidatura, CandidaturaFiltro } from '../../modules/inscricoes/domain/inscricoes.types';
import {
  matchesCandidaturaFiltro,
  type CandidaturasRepository,
} from '../../modules/inscricoes/repositories/candidaturas.repository';

import { apagarColecao, COLECOES, idSeguro, jaExiste, ordenarPorData, paraDominio } from './firestore.helpers';

/** Adapter Firestore da porta CandidaturasRepository. Um aluno se candidata uma vez por projeto. */
export class FirestoreCandidaturasRepository implements CandidaturasRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.candidaturas);
  }

  private indice(inscricaoId: string, discenteId: string) {
    return this.db.collection(COLECOES.candidaturasUnicas).doc(idSeguro(inscricaoId, discenteId));
  }

  async create(candidatura: Candidatura): Promise<Candidatura> {
    const batch = this.db.batch();
    batch.create(this.indice(candidatura.inscricaoId, candidatura.discenteId), { candidaturaId: candidatura.id });
    batch.create(this.colecao.doc(candidatura.id), candidatura);
    try {
      await batch.commit();
    } catch (error) {
      if (jaExiste(error)) throw new ConflictError('Você já se candidatou a este projeto.');
      throw error;
    }
    return { ...candidatura };
  }

  async findById(id: string): Promise<Candidatura | undefined> {
    const doc = await this.colecao.doc(id).get();
    return doc.exists ? paraDominio<Candidatura>(doc.data()!) : undefined;
  }

  async findByInscricaoAndDiscente(inscricaoId: string, discenteId: string): Promise<Candidatura | undefined> {
    const indice = await this.indice(inscricaoId, discenteId).get();
    const candidaturaId = indice.data()?.['candidaturaId'] as string | undefined;
    return candidaturaId ? this.findById(candidaturaId) : undefined;
  }

  async list(filtro: CandidaturaFiltro = {}): Promise<Candidatura[]> {
    const consulta = filtro.inscricaoId
      ? this.colecao.where('inscricaoId', '==', filtro.inscricaoId)
      : filtro.discenteId
        ? this.colecao.where('discenteId', '==', filtro.discenteId)
        : filtro.status
          ? this.colecao.where('status', '==', filtro.status)
          : this.colecao;
    const snap = await consulta.get();
    return ordenarPorData(snap.docs, (d) => paraDominio<Candidatura>(d), (c) => c.criadoEm).filter((c) =>
      matchesCandidaturaFiltro(c, filtro),
    );
  }

  async update(candidatura: Candidatura): Promise<Candidatura> {
    await this.colecao.doc(candidatura.id).set(candidatura);
    return { ...candidatura };
  }

  async delete(id: string): Promise<void> {
    const atual = await this.findById(id);
    if (!atual) return;
    const batch = this.db.batch();
    batch.delete(this.colecao.doc(id));
    batch.delete(this.indice(atual.inscricaoId, atual.discenteId));
    await batch.commit();
  }

  async clear(): Promise<void> {
    await apagarColecao(this.db, COLECOES.candidaturas);
    await apagarColecao(this.db, COLECOES.candidaturasUnicas);
  }
}
