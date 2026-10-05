import { Prisma } from '@prisma/client';

import type { PrismaClient } from './prisma.client';

import type {
  Anexo,
  AnexoTipo,
  Inscricao,
  InscricaoFiltro,
  InscricaoStatus,
  VinculoStatus,
} from '../../modules/inscricoes/domain/inscricoes.types';
import type {
  AprovacaoResultado,
  InscricoesRepository,
} from '../../modules/inscricoes/repositories/inscricoes.repository';

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
    // Só mexe nos anexos que mudaram: o auto-save (que não toca anexos) vira um único UPDATE.
    const updated = await this.prisma.$transaction(async (tx) => {
      const atuais = await tx.anexo.findMany({ where: { inscricaoId: inscricao.id }, select: { id: true } });
      const atuaisIds = new Set(atuais.map((a) => a.id));
      const novosIds = new Set(inscricao.anexos.map((a) => a.id));
      const removidos = atuais.filter((a) => !novosIds.has(a.id)).map((a) => a.id);
      if (removidos.length > 0) {
        await tx.anexo.deleteMany({ where: { id: { in: removidos } } });
      }
      return tx.inscricao.update({
        where: { id: inscricao.id },
        data: {
          ...toRow(inscricao),
          anexos: { create: inscricao.anexos.filter((a) => !atuaisIds.has(a.id)).map(toAnexoRow) },
        },
        include: { anexos: true },
      });
    });
    return toDomain(updated);
  }

  async proximoSequencialProtocolo(ano: number): Promise<number> {
    try {
      return await this.reservarSequencial(ano);
    } catch (error) {
      // Dois primeiros envios do ano criando a linha ao mesmo tempo: o perdedor tenta de novo (agora é increment).
      if ((error as { code?: unknown }).code === 'P2002') return this.reservarSequencial(ano);
      throw error;
    }
  }

  private async reservarSequencial(ano: number): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const atual = await tx.sequenciaProtocolo.findUnique({ where: { ano } });
      if (atual) {
        const seq = await tx.sequenciaProtocolo.update({ where: { ano }, data: { ultimo: { increment: 1 } } });
        return seq.ultimo;
      }
      // Primeira reserva do ano: parte dos protocolos já emitidos antes da tabela de sequência existir.
      const emitidos = await tx.inscricao.count({ where: { protocolo: { contains: `/${ano}-` } } });
      const seq = await tx.sequenciaProtocolo.create({ data: { ano, ultimo: emitidos + 1 } });
      return seq.ultimo;
    });
  }

  async aprovarDentroDaCota(inscricao: Inscricao, limite: number): Promise<AprovacaoResultado> {
    return this.prisma.$transaction(
      async (tx) => {
        const aprovadas = await tx.inscricao.count({
          where: {
            id: { not: inscricao.id },
            editalId: inscricao.editalId,
            subareaCode: inscricao.subareaCode,
            status: 'APROVADA',
          },
        });
        if (aprovadas >= limite) return { aprovadas };
        const { id, ...data } = toRow(inscricao);
        const updated = await tx.inscricao.update({ where: { id }, data, include: { anexos: true } });
        return { aprovadas, salva: toDomain(updated) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async clear(): Promise<void> {
    await this.prisma.sequenciaProtocolo.deleteMany();
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
