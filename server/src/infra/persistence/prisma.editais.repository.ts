import type { PrismaClient } from './prisma.client';

import type { BolsaTipo, Edital, EditalStatus } from '../../modules/editais/domain/editais.types';
import type { CotaSubarea } from '../../modules/editais/domain/cotas.types';
import type {
  EditaisRepository,
  EditalStatusFilter,
} from '../../modules/editais/repositories/editais.repository';

/**
 * Adapter Prisma da porta EditaisRepository — persistência REAL.
 * As cotas são gravadas na tabela CotaSubarea (FK cascade) e lidas aninhadas.
 */
export class PrismaEditaisRepository implements EditaisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(edital: Edital): Promise<Edital> {
    const created = await this.prisma.edital.create({
      data: {
        id: edital.id,
        numero: edital.numero,
        titulo: edital.titulo,
        descricao: edital.descricao,
        status: edital.status,
        tipoBolsa: edital.tipoBolsa,
        totalCotas: edital.totalCotas,
        dataInicioInscricoes: edital.dataInicioInscricoes,
        dataFimInscricoes: edital.dataFimInscricoes,
        publicadoEm: edital.publicadoEm,
        encerradoEm: edital.encerradoEm,
        criadoEm: edital.criadoEm,
        cotas: {
          create: edital.cotas.map((cota) => ({
            subareaCode: cota.subareaCode,
            subareaNome: cota.subareaNome,
            quantidade: cota.quantidade,
          })),
        },
      },
      include: { cotas: true },
    });
    return toDomain(created);
  }

  async findById(id: string): Promise<Edital | undefined> {
    const found = await this.prisma.edital.findUnique({ where: { id }, include: { cotas: true } });
    return found ? toDomain(found) : undefined;
  }

  async findByNumero(numero: string): Promise<Edital | undefined> {
    const found = await this.prisma.edital.findUnique({ where: { numero }, include: { cotas: true } });
    return found ? toDomain(found) : undefined;
  }

  async list(status?: EditalStatusFilter): Promise<Edital[]> {
    const all = await this.prisma.edital.findMany({
      where: status ? { status } : undefined,
      include: { cotas: true },
      orderBy: { criadoEm: 'desc' },
    });
    return all.map(toDomain);
  }

  async update(edital: Edital): Promise<Edital> {
    // Substitui o conjunto de cotas (deleteMany + recreate) — o service já
    // validou a consistência antes de chamar o repositório.
    await this.prisma.cotaSubarea.deleteMany({ where: { editalId: edital.id } });
    const updated = await this.prisma.edital.update({
      where: { id: edital.id },
      data: {
        numero: edital.numero,
        titulo: edital.titulo,
        descricao: edital.descricao,
        status: edital.status,
        tipoBolsa: edital.tipoBolsa,
        totalCotas: edital.totalCotas,
        dataInicioInscricoes: edital.dataInicioInscricoes,
        dataFimInscricoes: edital.dataFimInscricoes,
        publicadoEm: edital.publicadoEm,
        encerradoEm: edital.encerradoEm,
        atualizadoEm: edital.atualizadoEm,
        cotas: {
          create: edital.cotas.map((cota) => ({
            subareaCode: cota.subareaCode,
            subareaNome: cota.subareaNome,
            quantidade: cota.quantidade,
          })),
        },
      },
      include: { cotas: true },
    });
    return toDomain(updated);
  }

  async clear(): Promise<void> {
    await this.prisma.cotaSubarea.deleteMany();
    await this.prisma.edital.deleteMany();
  }
}

type EditalRow = {
  id: string;
  numero: string;
  titulo: string;
  descricao: string;
  status: string;
  tipoBolsa: string;
  totalCotas: number;
  dataInicioInscricoes: Date;
  dataFimInscricoes: Date;
  publicadoEm: Date | null;
  encerradoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  cotas: { subareaCode: string; subareaNome: string; quantidade: number }[];
};

function toDomain(row: EditalRow): Edital {
  const cotas: CotaSubarea[] = row.cotas.map((c) => ({
    subareaCode: c.subareaCode,
    subareaNome: c.subareaNome,
    quantidade: c.quantidade,
  }));
  return {
    id: row.id,
    numero: row.numero,
    titulo: row.titulo,
    descricao: row.descricao,
    status: row.status as EditalStatus,
    tipoBolsa: row.tipoBolsa as BolsaTipo,
    totalCotas: row.totalCotas,
    cotas,
    dataInicioInscricoes: row.dataInicioInscricoes,
    dataFimInscricoes: row.dataFimInscricoes,
    publicadoEm: row.publicadoEm,
    encerradoEm: row.encerradoEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}
