import type { PrismaClient } from './prisma.client';

import type {
  Candidatura,
  CandidaturaFiltro,
  CandidaturaStatus,
} from '../../modules/inscricoes/domain/inscricoes.types';
import type { CandidaturasRepository } from '../../modules/inscricoes/repositories/candidaturas.repository';

/** Adapter Prisma da porta CandidaturasRepository. */
export class PrismaCandidaturasRepository implements CandidaturasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(candidatura: Candidatura): Promise<Candidatura> {
    return toDomain(await this.prisma.candidatura.create({ data: candidatura }));
  }

  async findById(id: string): Promise<Candidatura | undefined> {
    const found = await this.prisma.candidatura.findUnique({ where: { id } });
    return found ? toDomain(found) : undefined;
  }

  async findByInscricaoAndDiscente(inscricaoId: string, discenteId: string): Promise<Candidatura | undefined> {
    const found = await this.prisma.candidatura.findUnique({
      where: { inscricaoId_discenteId: { inscricaoId, discenteId } },
    });
    return found ? toDomain(found) : undefined;
  }

  async list(filtro: CandidaturaFiltro = {}): Promise<Candidatura[]> {
    const rows = await this.prisma.candidatura.findMany({
      where: { inscricaoId: filtro.inscricaoId, discenteId: filtro.discenteId, status: filtro.status },
      orderBy: { criadoEm: 'asc' },
    });
    return rows.map(toDomain);
  }

  async update(candidatura: Candidatura): Promise<Candidatura> {
    const { id, ...data } = candidatura;
    return toDomain(await this.prisma.candidatura.update({ where: { id }, data }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.candidatura.delete({ where: { id } });
  }

  async clear(): Promise<void> {
    await this.prisma.candidatura.deleteMany();
  }
}

type CandidaturaRow = Omit<Candidatura, 'status'> & { status: string };

function toDomain(row: CandidaturaRow): Candidatura {
  return { ...row, status: row.status as CandidaturaStatus };
}
