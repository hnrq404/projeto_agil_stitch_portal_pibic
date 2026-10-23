import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '@shared/auth/auth.types';
import type { Clock } from '@shared/time/clock';

import type {
  AcaoAuditoria,
  EntidadeAuditoria,
  FiltroAuditoria,
  RegistroAuditoria,
} from './domain/auditoria.types';
import type { AuditoriaRepository } from './repositories/auditoria.repository';

/**
 * Trilha de auditoria: registra quem publicou um edital, homologou uma
 * proposta, trocou o papel de alguém etc. O registro é feito depois que a
 * ação deu certo.
 */
export class AuditoriaService {
  constructor(
    private readonly repository: AuditoriaRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * Nunca lança: a ação principal já foi gravada, e devolver erro agora levaria
   * o usuário a repeti-la. A falha vai para o log do servidor.
   */
  async registrar(
    actor: AuthenticatedUser,
    acao: AcaoAuditoria,
    entidade: EntidadeAuditoria,
    entidadeId: string,
    detalhes: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.repository.create({
        id: randomUUID(),
        actorId: actor.id,
        actorNome: actor.name,
        acao,
        entidade,
        entidadeId,
        detalhes,
        criadoEm: this.clock.now(),
      });
    } catch (error) {
      console.error('[auditoria] Falha ao registrar', { acao, entidade, entidadeId }, error);
    }
  }

  async listar(filtro: FiltroAuditoria): Promise<{ data: RegistroAuditoria[]; total: number }> {
    return this.repository.list(filtro);
  }
}
