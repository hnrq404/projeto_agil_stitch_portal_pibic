import type { PrismaClient } from './prisma.client';

import type {
  Relatorio,
  RelatorioStatus,
  RelatorioTipo,
} from '../../modules/projetos/domain/projetos.types';
import type { RelatoriosRepository } from '../../modules/projetos/repositories/relatorios.repository';

/** Adapter Prisma da porta RelatoriosRepository. */
export class PrismaRelatoriosRepository implements RelatoriosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(relatorio: Relatorio): Promise<Relatorio> {
    return toDomain(await this.prisma.relatorio.create({ data: relatorio }));
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
    const { id, ...data } = relatorio;
    return toDomain(await this.prisma.relatorio.update({ where: { id }, data }));
  }

  async clear(): Promise<void> {
    await this.prisma.relatorio.deleteMany();
  }
}

type RelatorioRow = Omit<Relatorio, 'tipo' | 'status' | 'mimeType'> & {
  tipo: string;
  status: string;
  mimeType: string;
};

function toDomain(row: RelatorioRow): Relatorio {
  return {
    ...row,
    tipo: row.tipo as RelatorioTipo,
    status: row.status as RelatorioStatus,
    mimeType: 'application/pdf',
  };
}
