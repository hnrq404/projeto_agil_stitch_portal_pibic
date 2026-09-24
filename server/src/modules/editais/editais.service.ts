import { randomUUID } from 'node:crypto';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@shared/errors/domain.errors';
import type { Clock } from '@shared/time/clock';

import type {
  CreateEditalInput,
  Edital,
  UpdateEditalInput,
} from './domain/editais.types';
import {
  assertClosable,
  assertEditable,
  assertPublishable,
  assertTransition,
  resolveAutomaticStatus,
  validateCotas,
} from './domain/editais.rules';
import type { EditalStatusFilter, EditaisRepository } from './repositories/editais.repository';

/** Interface mínima esperada pelo serviço de notificações (evita dependência circular). */
export interface EditalEventsPort {
  onEditalPublicado(event: {
    editalId: string;
    numero: string;
    titulo: string;
    tipoBolsa: string;
    totalCotas: number;
    dataFimInscricoes: Date;
  }): Promise<unknown>;
}

export class EditaisService {
  constructor(
    private readonly repository: EditaisRepository,
    private readonly clock: Clock,
    private readonly events?: EditalEventsPort,
  ) {}

  /** Cria um edital em RASCUNHO com validação de consistência das cotas. */
  async create(input: CreateEditalInput, actorId: string): Promise<Edital> {
    const now = this.clock.now();

    const numeroDuplicado = await this.repository.findByNumero(input.numero);
    if (numeroDuplicado) {
      throw new ConflictError(`Já existe um edital com o número ${input.numero}.`, {
        numero: input.numero,
      });
    }

    // Regra de Consistência de Cotas: soma por subárea ≤ totalCotas.
    const cotasNormalizadas = validateCotas(input.totalCotas, input.cotas);

    if (Date.parse(input.dataFimInscricoes) <= Date.parse(input.dataInicioInscricoes)) {
      throw new ValidationError('dataFimInscricoes deve ser posterior a dataInicioInscricoes.');
    }

    const edital: Edital = {
      id: randomUUID(),
      numero: input.numero,
      titulo: input.titulo,
      descricao: input.descricao ?? '',
      status: 'RASCUNHO',
      tipoBolsa: input.tipoBolsa,
      totalCotas: input.totalCotas,
      cotas: cotasNormalizadas,
      dataInicioInscricoes: new Date(input.dataInicioInscricoes),
      dataFimInscricoes: new Date(input.dataFimInscricoes),
      publicadoEm: null,
      encerradoEm: null,
      criadoEm: now,
      atualizadoEm: now,
    };

    return this.repository.create(edital);
  }

  /** Lista editais administrativos, opcionalmente filtrando por status. */
  async list(status?: EditalStatusFilter): Promise<Edital[]> {
    await this.syncAutomaticClosure();
    return this.repository.list(status);
  }

  async getById(id: string): Promise<Edital> {
    const edital = await this.repository.findById(id);
    if (!edital) {
      throw new NotFoundError(`Edital ${id} não encontrado.`);
    }
    return edital;
  }

  /**
   * Atualiza um edital — SOMENTE em RASCUNHO (regra da Sprint 2).
   * Se cotas ou totalCotas mudarem, a consistência é revalidada.
   */
  async update(id: string, input: UpdateEditalInput, actorId: string): Promise<Edital> {
    const edital = await this.getById(id);
    assertEditable(edital);

    const numero = input.numero ?? edital.numero;
    if (numero !== edital.numero) {
      const numeroDuplicado = await this.repository.findByNumero(numero);
      if (numeroDuplicado && numeroDuplicado.id !== id) {
        throw new ConflictError(`Já existe um edital com o número ${numero}.`, { numero });
      }
    }

    const totalCotas = input.totalCotas ?? edital.totalCotas;
    const cotas = input.cotas ? validateCotas(totalCotas, input.cotas) : edital.cotas;

    const dataInicio = input.dataInicioInscricoes
      ? new Date(input.dataInicioInscricoes)
      : edital.dataInicioInscricoes;
    const dataFim = input.dataFimInscricoes
      ? new Date(input.dataFimInscricoes)
      : edital.dataFimInscricoes;
    if (dataFim.getTime() <= dataInicio.getTime()) {
      throw new ValidationError('dataFimInscricoes deve ser posterior a dataInicioInscricoes.');
    }

    return this.repository.update({
      ...edital,
      numero,
      titulo: input.titulo ?? edital.titulo,
      descricao: input.descricao ?? edital.descricao,
      tipoBolsa: input.tipoBolsa ?? edital.tipoBolsa,
      totalCotas,
      cotas,
      dataInicioInscricoes: dataInicio,
      dataFimInscricoes: dataFim,
      atualizadoEm: this.clock.now(),
    });
  }

  /**
   * Transição de estado: "publicar" (RASCUNHO → PUBLICADO, dispara notificação)
   * ou "encerrar" (PUBLICADO → ENCERRADO).
   */
  async transition(id: string, acao: 'publicar' | 'encerrar', actorId: string): Promise<Edital> {
    const edital = await this.getById(id);

    assertTransition(edital.status, acao === 'publicar' ? 'PUBLICADO' : 'ENCERRADO');

    if (acao === 'publicar') {
      assertPublishable(edital, this.clock);

      const saved = await this.repository.update({
        ...edital,
        status: 'PUBLICADO',
        publicadoEm: this.clock.now(),
        atualizadoEm: this.clock.now(),
      });

      // Evento de publicação → notificação in-app (requisito 4 da Sprint 2).
      if (this.events) {
        await this.events.onEditalPublicado({
          editalId: saved.id,
          numero: saved.numero,
          titulo: saved.titulo,
          tipoBolsa: saved.tipoBolsa,
          totalCotas: saved.totalCotas,
          dataFimInscricoes: saved.dataFimInscricoes,
        });
      }
      return saved;
    }

    // acao === 'encerrar'
    assertClosable(edital, this.clock);
    return this.repository.update({
      ...edital,
      status: 'ENCERRADO',
      encerradoEm: this.clock.now(),
      atualizadoEm: this.clock.now(),
    });
  }

  /** Encerramento automático por prazo (S2.3). Chamado antes das listagens. */
  async syncAutomaticClosure(): Promise<number> {
    const publicados = await this.repository.list('PUBLICADO');
    let closed = 0;
    for (const edital of publicados) {
      if (resolveAutomaticStatus(edital, this.clock) === 'ENCERRADO') {
        await this.repository.update({
          ...edital,
          status: 'ENCERRADO',
          encerradoEm: this.clock.now(),
          atualizadoEm: this.clock.now(),
        });
        closed += 1;
      }
    }
    return closed;
  }
}
