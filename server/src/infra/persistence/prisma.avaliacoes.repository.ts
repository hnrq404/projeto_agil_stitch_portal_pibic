import type { Avaliacao as AvaliacaoRow } from '@prisma/client';

import type { PrismaClient } from './prisma.client';

import type {
  Avaliacao,
  AvaliacaoFiltro,
  AvaliacaoStatus,
  NotaCriterio,
} from '../../modules/avaliacoes/domain/avaliacoes.types';
import type { AvaliacoesRepository } from '../../modules/avaliacoes/repositories/avaliacoes.repository';

/** Adapter Prisma da porta AvaliacoesRepository. As notas por critério ficam em uma coluna JSON. */
export class PrismaAvaliacoesRepository implements AvaliacoesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(avaliacao: Avaliacao): Promise<Avaliacao> {
    return toDomain(await this.prisma.avaliacao.create({ data: toRow(avaliacao) }));
  }

  async findById(id: string): Promise<Avaliacao | undefined> {
    const found = await this.prisma.avaliacao.findUnique({ where: { id } });
    return found ? toDomain(found) : undefined;
  }

  async list(filtro: AvaliacaoFiltro = {}): Promise<Avaliacao[]> {
    const rows = await this.prisma.avaliacao.findMany({
      where: {
        inscricaoId: filtro.inscricaoIds ? { in: [...filtro.inscricaoIds] } : filtro.inscricaoId,
        avaliadorId: filtro.avaliadorId,
        status: filtro.status,
      },
      orderBy: { atribuidaEm: 'asc' },
    });
    return rows.map(toDomain);
  }

  async update(avaliacao: Avaliacao): Promise<Avaliacao> {
    const { id, ...data } = toRow(avaliacao);
    return toDomain(await this.prisma.avaliacao.update({ where: { id }, data }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.avaliacao.delete({ where: { id } });
  }

  async clear(): Promise<void> {
    await this.prisma.avaliacao.deleteMany();
  }
}

function toRow(a: Avaliacao) {
  return {
    id: a.id,
    inscricaoId: a.inscricaoId,
    avaliadorId: a.avaliadorId,
    status: a.status,
    notas: JSON.stringify(a.notas),
    notaFinal: a.notaFinal,
    parecer: a.parecer,
    atribuidaEm: a.atribuidaEm,
    concluidaEm: a.concluidaEm,
  };
}

function toDomain(row: AvaliacaoRow): Avaliacao {
  return {
    ...row,
    status: row.status as AvaliacaoStatus,
    notas: JSON.parse(row.notas) as NotaCriterio[],
  };
}
