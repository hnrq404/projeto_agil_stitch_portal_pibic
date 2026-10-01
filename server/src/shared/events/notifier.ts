import type { NotificacaoInput } from '../../modules/notificacoes/domain/notificacoes.types';

/**
 * Porta de notificação usada pelos casos de uso de inscrição, avaliação e
 * projetos. O NotificacoesService a implementa; os testes podem injetar um spy.
 */
export interface Notifier {
  notify(userIds: readonly string[], input: NotificacaoInput): Promise<unknown>;
}
