import type { Firestore, Query } from 'firebase-admin/firestore';

import type { Inscricao, InscricaoFiltro } from '../../modules/inscricoes/domain/inscricoes.types';
import {
  matchesFiltro,
  type AprovacaoResultado,
  type InscricoesRepository,
} from '../../modules/inscricoes/repositories/inscricoes.repository';

import { apagarColecao, COLECOES, idSeguro, ordenarPorData, paraDominio } from './firestore.helpers';

/**
 * Adapter Firestore da porta InscricoesRepository. Os anexos ficam embutidos
 * no documento (são no máximo dois), então cada gravação é atômica.
 */
export class FirestoreInscricoesRepository implements InscricoesRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.inscricoes);
  }

  async create(inscricao: Inscricao): Promise<Inscricao> {
    await this.colecao.doc(inscricao.id).create(inscricao);
    return clone(inscricao);
  }

  async findById(id: string): Promise<Inscricao | undefined> {
    const doc = await this.colecao.doc(id).get();
    return doc.exists ? toDomain(doc.data()!) : undefined;
  }

  async findByEditalAndDiscente(editalId: string, discenteId: string): Promise<Inscricao | undefined> {
    const snap = await this.colecao.where('discenteId', '==', discenteId).get();
    return snap.docs.map((d) => toDomain(d.data())).find((i) => i.editalId === editalId);
  }

  async list(filtro: InscricaoFiltro = {}): Promise<Inscricao[]> {
    const snap = await consultaPorUmCampo(this.colecao, filtro).get();
    return ordenarPorData(snap.docs, toDomain, (i) => i.atualizadoEm, 'desc').filter((i) => matchesFiltro(i, filtro));
  }

  async update(inscricao: Inscricao): Promise<Inscricao> {
    await this.colecao.doc(inscricao.id).set(inscricao);
    return clone(inscricao);
  }

  async proximoSequencialProtocolo(ano: number): Promise<number> {
    const ref = this.db.collection(COLECOES.sequenciasProtocolo).doc(String(ano));
    // A transação refaz a leitura se outro envio gravou no meio: nunca repete número.
    return this.db.runTransaction(async (tx) => {
      const atual = await tx.get(ref);
      const proximo = ((atual.data()?.['ultimo'] as number | undefined) ?? 0) + 1;
      tx.set(ref, { ano, ultimo: proximo });
      return proximo;
    });
  }

  async aprovarDentroDaCota(inscricao: Inscricao, limite: number): Promise<AprovacaoResultado> {
    // Toda aprovação da mesma subárea lê e grava a mesma trava: duas homologações
    // simultâneas entram em conflito, e a segunda refaz a contagem já vendo a primeira.
    const trava = this.db.collection(COLECOES.travasCota).doc(idSeguro(inscricao.editalId, inscricao.subareaCode));
    return this.db.runTransaction(async (tx) => {
      await tx.get(trava);
      const doEdital = await tx.get(this.colecao.where('editalId', '==', inscricao.editalId));
      const aprovadas = doEdital.docs
        .map((d) => d.data())
        .filter(
          (d) => d['id'] !== inscricao.id && d['subareaCode'] === inscricao.subareaCode && d['status'] === 'APROVADA',
        ).length;
      if (aprovadas >= limite) return { aprovadas };
      tx.set(this.colecao.doc(inscricao.id), inscricao);
      tx.set(trava, { editalId: inscricao.editalId, subareaCode: inscricao.subareaCode, atualizadoEm: new Date() });
      return { aprovadas, salva: clone(inscricao) };
    });
  }

  async clear(): Promise<void> {
    await apagarColecao(this.db, COLECOES.inscricoes);
    await apagarColecao(this.db, COLECOES.sequenciasProtocolo);
    await apagarColecao(this.db, COLECOES.travasCota);
  }
}

/**
 * Filtra no Firestore por um único campo (o mais seletivo) e o resto em memória.
 * Consultas de um campo só nunca exigem índice composto, então nada quebra em
 * produção por índice faltando, e o volume de um edital cabe com folga.
 */
function consultaPorUmCampo(colecao: FirebaseFirestore.CollectionReference, filtro: InscricaoFiltro): Query {
  if (filtro.discenteId) return colecao.where('discenteId', '==', filtro.discenteId);
  if (filtro.orientadorId) return colecao.where('orientadorId', '==', filtro.orientadorId);
  if (filtro.editalId) return colecao.where('editalId', '==', filtro.editalId);
  if (filtro.subareaCode) return colecao.where('subareaCode', '==', filtro.subareaCode);
  if (filtro.status?.length) return colecao.where('status', 'in', [...filtro.status]);
  return colecao;
}

function toDomain(data: FirebaseFirestore.DocumentData): Inscricao {
  const inscricao = paraDominio<Inscricao>(data);
  return { ...inscricao, anexos: inscricao.anexos ?? [] };
}

function clone(inscricao: Inscricao): Inscricao {
  return { ...inscricao, anexos: inscricao.anexos.map((a) => ({ ...a })) };
}
