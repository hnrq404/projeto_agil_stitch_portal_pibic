import type { PrismaClient } from './prisma.client';

import type { Notificacao } from '../../modules/notificacoes/domain/notificacoes.types';
import type { NotificacoesRepository } from '../../modules/notificacoes/repositories/notificacoes.repository';

/** Adapter Prisma da porta NotificacoesRepository — persistência REAL. */
export class PrismaNotificacoesRepository implements NotificacoesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(notificacao: Notificacao): Promise<Notificacao> {
    const created = await this.prisma.notificacao.create({
      data: {
        id: notificacao.id,
        userId: notificacao.userId,
        tipo: notificacao.tipo,
        titulo: notificacao.titulo,
        mensagem: notificacao.mensagem,
        referenceId: notificacao.referenceId ?? null,
        lida: notificacao.lida,
        criadoEm: notificacao.criadoEm,
      },
    });
    return toDomain(created);
  }

  async listByUser(userId: string, onlyUnread = false): Promise<Notificacao[]> {
    const rows = await this.prisma.notificacao.findMany({
      where: { userId, ...(onlyUnread ? { lida: false } : {}) },
      orderBy: { criadoEm: 'desc' },
    });
    return rows.map(toDomain);
  }

  async markAsRead(userId: string, notificacaoId: string): Promise<Notificacao> {
    // Filtra pelo dono na própria escrita: nunca altera notificação de outro usuário.
    const { count } = await this.prisma.notificacao.updateMany({
      where: { id: notificacaoId, userId },
      data: { lida: true },
    });
    if (count === 0) {
      throw new Error('Notificação não encontrada para este usuário.');
    }
    const updated = await this.prisma.notificacao.findUniqueOrThrow({ where: { id: notificacaoId } });
    return toDomain(updated);
  }

  async clear(): Promise<void> {
    await this.prisma.notificacao.deleteMany();
  }
}

type NotificacaoRow = {
  id: string;
  userId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referenceId: string | null;
  lida: boolean;
  criadoEm: Date;
};

function toDomain(row: NotificacaoRow): Notificacao {
  return {
    id: row.id,
    userId: row.userId,
    tipo: row.tipo as Notificacao['tipo'],
    titulo: row.titulo,
    mensagem: row.mensagem,
    referenceId: row.referenceId ?? undefined,
    lida: row.lida,
    criadoEm: row.criadoEm,
  };
}
