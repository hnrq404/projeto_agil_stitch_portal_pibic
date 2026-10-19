import type { Relatorio as RelatorioRow } from '@prisma/client';

import type { PrismaClient } from './prisma.client';

import type {
  Relatorio,
  RelatorioStatus,
  RelatorioTipo,
} from '../../modules/projetos/domain/projetos.types';
import type { RelatoriosRepository } from '../../modules/projetos/repositories/relatorios.repository';

/** Adapter Prisma da porta RelatoriosRepository. O PDF opcional vira colunas anuláveis. */
export class PrismaRelatoriosRepository implements RelatoriosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(relatorio: Relatorio): Promise<Relatorio> {
    return toDomain(await this.prisma.relatorio.create({ data: toRow(relatorio) }));
  }

  async findById(id: string): Promise<Relatorio | undefined> {
    const found = await this.prisma.relatorio.findUnique({ where: { id } });
    return found ? toDomain(found) : undefined;
  }

  async listByInscricao(inscricaoId: string): Promise<Relatorio[]> {
    const rows = await this.prisma.relatorio.findMany({
      where: { inscricaoId },
      orderBy: { enviadoEm: 'asc' },
    });
    return rows.map(toDomain);
  }

  async list(filtro: { inscricaoIds?: readonly string[] } = {}): Promise<Relatorio[]> {
    const rows = await this.prisma.relatorio.findMany({
      where: filtro.inscricaoIds ? { inscricaoId: { in: [...filtro.inscricaoIds] } } : undefined,
      orderBy: { enviadoEm: 'asc' },
    });
    return rows.map(toDomain);
  }

  async update(relatorio: Relatorio): Promise<Relatorio> {
    const { id, ...data } = toRow(relatorio);
    return toDomain(await this.prisma.relatorio.update({ where: { id }, data }));
  }

  async clear(): Promise<void> {
    await this.prisma.relatorio.deleteMany();
  }
}

function toRow(r: Relatorio): RelatorioRow {
  return {
    id: r.id,
    inscricaoId: r.inscricaoId,
    tipo: r.tipo,
    competencia: r.competencia,
    versao: r.versao,
    status: r.status,
    descricao: r.descricao,
    comentarioOrientador: r.comentarioOrientador,
    storageKey: r.arquivo?.storageKey ?? null,
    nome: r.arquivo?.nome ?? null,
    tamanho: r.arquivo?.tamanho ?? null,
    mimeType: r.arquivo?.mimeType ?? null,
    enviadoEm: r.enviadoEm,
    avaliadoEm: r.avaliadoEm,
  };
}

function toDomain(row: RelatorioRow): Relatorio {
  return {
    id: row.id,
    inscricaoId: row.inscricaoId,
    tipo: row.tipo as RelatorioTipo,
    competencia: row.competencia,
    versao: row.versao,
    status: row.status as RelatorioStatus,
    descricao: row.descricao,
    arquivo:
      row.storageKey && row.nome
        ? { storageKey: row.storageKey, nome: row.nome, tamanho: row.tamanho ?? 0, mimeType: 'application/pdf' }
        : null,
    comentarioOrientador: row.comentarioOrientador,
    enviadoEm: row.enviadoEm,
    avaliadoEm: row.avaliadoEm,
  };
}
