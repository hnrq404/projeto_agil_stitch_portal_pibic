import type { Firestore } from 'firebase-admin/firestore';

import type { FiltroAuditoria, RegistroAuditoria } from '../../modules/auditoria/domain/auditoria.types';
import type { AuditoriaRepository } from '../../modules/auditoria/repositories/auditoria.repository';

import { COLECOES, ordenarPorData, paraDominio } from './firestore.helpers';

/** Adapter Firestore da porta AuditoriaRepository. */
export class FirestoreAuditoriaRepository implements AuditoriaRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.auditoria);
  }

  async create(registro: RegistroAuditoria): Promise<void> {
    await this.colecao.doc(registro.id).set(registro);
  }

  async list(filtro: FiltroAuditoria): Promise<{ data: RegistroAuditoria[]; total: number }> {
    const consulta = filtro.entidadeId
      ? this.colecao.where('entidadeId', '==', filtro.entidadeId)
      : filtro.actorId
        ? this.colecao.where('actorId', '==', filtro.actorId)
        : filtro.entidade
          ? this.colecao.where('entidade', '==', filtro.entidade)
          : undefined;

    if (!consulta) {
      // Sem filtro: só os mais recentes, sem ler a coleção inteira.
      const [pagina, total] = await Promise.all([
        this.colecao.orderBy('criadoEm', 'desc').limit(filtro.limite).get(),
        this.colecao.count().get(),
      ]);
      return { data: pagina.docs.map((d) => paraDominio<RegistroAuditoria>(d.data())), total: total.data().count };
    }

    const encontrados = ordenarPorData(
      (await consulta.get()).docs,
      (d) => paraDominio<RegistroAuditoria>(d),
      (r) => r.criadoEm,
      'desc',
    ).filter(
      (r) =>
        (!filtro.entidade || r.entidade === filtro.entidade) &&
        (!filtro.entidadeId || r.entidadeId === filtro.entidadeId) &&
        (!filtro.actorId || r.actorId === filtro.actorId),
    );
    return { data: encontrados.slice(0, filtro.limite), total: encontrados.length };
  }
}
