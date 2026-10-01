import { randomUUID } from 'node:crypto';

import type {
  EditalPublicadoEvent,
  Notificacao,
  NotificacaoInput,
} from './domain/notificacoes.types';
import type { NotificacoesRepository } from './repositories/notificacoes.repository';

/**
 * Serviço de notificações in-app.
 *
 * Sprint 2: recebe o evento "edital publicado" e gera notificação para todos os
 * usuários cadastrados (broadcast). Idempotente por (evento, usuário): se já
 * existe notificação do mesmo tipo para a mesma referência, não duplica.
 */
export type UserLister = () => Promise<{ id: string }[]> | { id: string }[];

export class NotificacoesService {
  constructor(
    private readonly repository: NotificacoesRepository,
    private readonly userDirectory: { listUsers: UserLister },
  ) {}

  /** Handler do evento de domínio "edital publicado". */
  async handleEditalPublicado(event: EditalPublicadoEvent): Promise<Notificacao[]> {
    const now = new Date();
    const recipients = await this.userDirectory.listUsers();

    const created: Notificacao[] = [];
    for (const user of recipients) {
      const existing = await this.repository.listByUser(user.id);
      const alreadyNotified = existing.some(
        (n) => n.tipo === 'EDITAL_PUBLICADO' && n.referenceId === event.editalId,
      );
      if (alreadyNotified) {
        continue;
      }
      created.push(
        await this.repository.create({
          id: randomUUID(),
          userId: user.id,
          tipo: 'EDITAL_PUBLICADO',
          titulo: `Edital ${event.numero} publicado`,
          mensagem:
            `O edital ${event.numero} — ${event.titulo} (${event.tipoBolsa}, ` +
            `${event.totalCotas} bolsas) está com inscrições abertas até ` +
            `${event.dataFimInscricoes.toLocaleDateString('pt-BR')}.`,
          referenceId: event.editalId,
          lida: false,
          criadoEm: now,
        }),
      );
    }
    return created;
  }

  /** Notificação direcionada: usada pelos módulos de inscrição, avaliação e projetos. */
  async notify(userIds: readonly string[], input: NotificacaoInput): Promise<Notificacao[]> {
    const now = new Date();
    const unique = [...new Set(userIds)];
    return Promise.all(
      unique.map((userId) =>
        this.repository.create({
          id: randomUUID(),
          userId,
          tipo: input.tipo,
          titulo: input.titulo,
          mensagem: input.mensagem,
          referenceId: input.referenceId,
          lida: false,
          criadoEm: now,
        }),
      ),
    );
  }

  async listByUser(userId: string, onlyUnread = false): Promise<Notificacao[]> {
    return this.repository.listByUser(userId, onlyUnread);
  }

  async markAsRead(userId: string, notificacaoId: string): Promise<Notificacao> {
    return this.repository.markAsRead(userId, notificacaoId);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const unread = await this.repository.listByUser(userId, true);
    await Promise.all(unread.map((n) => this.repository.markAsRead(userId, n.id)));
    return unread.length;
  }
}
