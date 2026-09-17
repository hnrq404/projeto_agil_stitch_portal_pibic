import { randomUUID } from 'node:crypto';

import type { EditalPublicadoEvent, Notificacao } from './domain/notificacoes.types';
import type { NotificacoesRepository } from './repositories/notificacoes.repository';

/**
 * Serviço de notificações in-app.
 *
 * Sprint 2: recebe o evento "edital publicado" e gera notificação para todos os
 * usuários cadastrados (broadcast). Idempotente por (evento, usuário): se já
 * existe notificação do mesmo tipo para a mesma referência, não duplica.
 */
export class NotificacoesService {
  constructor(
    private readonly repository: NotificacoesRepository,
    private readonly userDirectory: { listUsers(): { id: string }[] },
  ) {}

  /** Handler do evento de domínio "edital publicado". */
  async handleEditalPublicado(event: EditalPublicadoEvent): Promise<Notificacao[]> {
    const now = new Date();
    const recipients = this.userDirectory.listUsers();

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

  async listByUser(userId: string, onlyUnread = false): Promise<Notificacao[]> {
    return this.repository.listByUser(userId, onlyUnread);
  }

  async markAsRead(userId: string, notificacaoId: string): Promise<Notificacao> {
    return this.repository.markAsRead(userId, notificacaoId);
  }
}
