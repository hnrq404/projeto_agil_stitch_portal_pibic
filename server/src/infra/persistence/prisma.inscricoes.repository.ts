import type { Prisma } from '@prisma/client';

import type { PrismaClient } from './prisma.client';

import type {
  Anexo,
  AnexoTipo,
  Inscricao,
  InscricaoFiltro,
  InscricaoStatus,
  VinculoStatus,
} from '../../modules/inscricoes/domain/inscricoes.types';
import type { InscricoesRepository } from '../../modules/inscricoes/repositories/inscricoes.repository';

/** Adapter Prisma da porta InscricoesRepository. Anexos são gravados na tabela Anexo. */
export class PrismaInscricoesRepository implements InscricoesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(inscricao: Inscricao): Promise<Inscricao> {
    const created = await this.prisma.inscricao.create({
      data: { ...toRow(inscricao), anexos: { create: inscricao.anexos.map(toAnexoRow) } },
      include: { anexos: true },
    });
    return toDomain(created);
  }

  async findById(id: string): Promise<Inscricao | undefined> {
    const found = await this.prisma.inscricao.findUnique({ where: { id }, include: { anexos: true } });
    return found ? toDomain(found) : undefined;
  }

  async findByEditalAndDiscente(editalId: string, discenteId: string): Promise<Inscricao | undefined> {
    const found = await this.prisma.inscricao.findUnique({
      where: { editalId_discenteId: { editalId, discenteId } },
      include: { anexos: true },
    });
    return found ? toDomain(found) : undefined;
  }

  async list(filtro: InscricaoFiltro = {}): Promise<Inscricao[]> {
    const where: Prisma.InscricaoWhereInput = {
      editalId: filtro.editalId,
      discenteId: filtro.discenteId,
      orientadorId: filtro.orientadorId,
      subareaCode: filtro.subareaCode,
      status: filtro.status?.length ? { in: [...filtro.status] } : undefined,
    };
    const rows = await this.prisma.inscricao.findMany({
      where,
      include: { anexos: true },
      orderBy: { atualizadoEm: 'desc' },
    });
    return rows.map(toDomain);
  }

  async update(inscricao: Inscricao): Promise<Inscricao> {
    const [, updated] = await this.prisma.$transaction([
      this.prisma.anexo.deleteMany({ where: { inscricaoId: inscricao.id } }),
      this.prisma.inscricao.update({
        where: { id: inscricao.id },
        data: { ...toRow(inscricao), anexos: { create: inscricao.anexos.map(toAnexoRow) } },
        include: { anexos: true },
      }),
    ]);
    return toDomain(updated);
  }

  async countProtocolosNoAno(ano: number): Promise<number> {
    return this.prisma.inscricao.count({ where: { protocolo: { contains: `/${ano}-` } } });
  }

  async clear(): Promise<void> {
    await this.prisma.relatorio.deleteMany();
    await this.prisma.avaliacao.deleteMany();
    await this.prisma.anexo.deleteMany();
    await this.prisma.inscricao.deleteMany();
  }
}

function toRow(i: Inscricao) {
  return {
    id: i.id,
    protocolo: i.protocolo,
    editalId: i.editalId,
    discenteId: i.discenteId,
    orientadorId: i.orientadorId,
    titulo: i.titulo,
    subareaCode: i.subareaCode,
    subareaNome: i.subareaNome,
    palavrasChave: i.palavrasChave,
    resumo: i.resumo,
    objetivos: i.objetivos,
    metodologia: i.metodologia,
    status: i.status,
    vinculoStatus: i.vinculoStatus,
    vinculoComentario: i.vinculoComentario,
    homologacaoJustificativa: i.homologacaoJustificativa,
    submetidaEm: i.submetidaEm,
    homologadaEm: i.homologadaEm,
    criadoEm: i.criadoEm,
    atualizadoEm: i.atualizadoEm,
  };
}

function toAnexoRow(a: Anexo) {
  return {
    id: a.id,
    tipo: a.tipo,
    storageKey: a.storageKey,
    nome: a.nome,
    tamanho: a.tamanho,
    mimeType: a.mimeType,
    enviadoEm: a.enviadoEm,
  };
}

type InscricaoRow = Prisma.InscricaoGetPayload<{ include: { anexos: true } }>;

function toDomain(row: InscricaoRow): Inscricao {
  return {
    ...row,
    status: row.status as InscricaoStatus,
    vinculoStatus: row.vinculoStatus as VinculoStatus | null,
    anexos: row.anexos.map((a) => ({
      id: a.id,
      tipo: a.tipo as AnexoTipo,
      storageKey: a.storageKey,
      nome: a.nome,
      tamanho: a.tamanho,
      mimeType: 'application/pdf',
      enviadoEm: a.enviadoEm,
    })),
  };
}
