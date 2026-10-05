import { randomUUID } from 'node:crypto';

import { isGestorRole, type AuthenticatedUser } from '@shared/auth/auth.types';
import {
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '@shared/errors/domain.errors';
import type { Notifier } from '@shared/events/notifier';
import type { Clock } from '@shared/time/clock';

import type { UsuariosRepository } from '../auth/repositories/usuarios.repository';
import type { EditaisRepository } from '../editais/repositories/editais.repository';
import {
  assertCotaDisponivel,
  assertInscricaoTransition,
} from '../inscricoes/domain/inscricoes.rules';
import type { Inscricao, InscricaoStatus } from '../inscricoes/domain/inscricoes.types';
import type { InscricoesRepository } from '../inscricoes/repositories/inscricoes.repository';

import {
  assertParecer,
  assertQuantidadeAvaliadores,
  calcularNotaFinal,
  consolidar,
  motivoConflito,
} from './domain/avaliacoes.rules';
import type { Avaliacao, Consolidado, NotaCriterio } from './domain/avaliacoes.types';
import type { AvaliacoesRepository } from './repositories/avaliacoes.repository';

/** Status que aparecem na central de triagem (rascunhos ficam de fora). */
export const STATUS_TRIAGEM: readonly InscricaoStatus[] = [
  'SUBMETIDA',
  'EM_AVALIACAO',
  'AVALIADA',
  'APROVADA',
  'RECUSADA',
];

export interface ItemTriagem {
  inscricao: Inscricao;
  avaliacoes: Avaliacao[];
  consolidado: Consolidado;
}

export interface FiltroTriagem {
  editalId?: string;
  status?: InscricaoStatus;
  subareaCode?: string;
}

export class AvaliacoesService {
  constructor(
    private readonly avaliacoes: AvaliacoesRepository,
    private readonly inscricoes: InscricoesRepository,
    private readonly editais: EditaisRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly clock: Clock,
    private readonly notifier: Notifier,
  ) {}

  // ── Porta usada pelo módulo de inscrições (acesso do avaliador) ─────────

  async isAvaliadorDe(inscricaoId: string, avaliadorId: string): Promise<boolean> {
    const atribuidas = await this.avaliacoes.list({ inscricaoId, avaliadorId });
    return atribuidas.length > 0;
  }

  // ── Central de triagem (S4.1) ───────────────────────────────────────────

  async fila(filtro: FiltroTriagem = {}): Promise<ItemTriagem[]> {
    const inscricoes = await this.inscricoes.list({
      editalId: filtro.editalId,
      subareaCode: filtro.subareaCode,
      status: filtro.status ? [filtro.status] : STATUS_TRIAGEM,
    });
    const avaliacoes = await this.avaliacoes.list({ inscricaoIds: inscricoes.map((i) => i.id) });
    return inscricoes.map((inscricao) => {
      const daInscricao = avaliacoes.filter((a) => a.inscricaoId === inscricao.id);
      return { inscricao, avaliacoes: daInscricao, consolidado: consolidar(daInscricao) };
    });
  }

  async itemTriagem(inscricaoId: string): Promise<ItemTriagem> {
    const inscricao = await this.getInscricao(inscricaoId);
    const avaliacoes = await this.avaliacoes.list({ inscricaoId });
    return { inscricao, avaliacoes, consolidado: consolidar(avaliacoes) };
  }

  /** Atribui avaliadores a uma proposta com vínculo confirmado, checando conflito de interesse. */
  async atribuir(inscricaoId: string, avaliadorIds: readonly string[]): Promise<Avaliacao[]> {
    const inscricao = await this.getInscricao(inscricaoId);
    if (inscricao.status !== 'SUBMETIDA' && inscricao.status !== 'EM_AVALIACAO') {
      throw new UnprocessableEntityError(
        'Só é possível atribuir avaliadores a propostas submetidas ou em avaliação.',
        { status: inscricao.status },
      );
    }
    if (inscricao.vinculoStatus !== 'CONFIRMADO') {
      throw new UnprocessableEntityError(
        'Aguardando o orientador confirmar o vínculo antes da distribuição.',
      );
    }

    const existentes = await this.avaliacoes.list({ inscricaoId });
    const novos = [...new Set(avaliadorIds)].filter(
      (id) => !existentes.some((a) => a.avaliadorId === id),
    );
    if (novos.length === 0) {
      throw new ValidationError('Selecione ao menos um avaliador ainda não atribuído.');
    }
    assertQuantidadeAvaliadores(existentes.length, novos.length);

    const [avaliadores, orientador] = await Promise.all([
      this.usuarios.findManyByIds(novos),
      inscricao.orientadorId ? this.usuarios.findById(inscricao.orientadorId) : undefined,
    ]);
    for (const id of novos) {
      const avaliador = avaliadores.find((a) => a.id === id);
      if (!avaliador || avaliador.role !== 'AVALIADOR') {
        throw new ValidationError(`Usuário ${id} não é um avaliador cadastrado.`);
      }
      const conflito = motivoConflito(avaliador, orientador, inscricao.discenteId);
      if (conflito) {
        throw new UnprocessableEntityError(
          `Conflito de interesse com ${avaliador.nome}: ${conflito}.`,
          { avaliadorId: id },
        );
      }
    }

    const now = this.clock.now();
    const criadas = await Promise.all(
      novos.map((avaliadorId) =>
        this.avaliacoes.create({
          id: randomUUID(),
          inscricaoId,
          avaliadorId,
          status: 'PENDENTE',
          notas: [],
          notaFinal: null,
          parecer: '',
          atribuidaEm: now,
          concluidaEm: null,
        }),
      ),
    );

    if (inscricao.status === 'SUBMETIDA') {
      assertInscricaoTransition(inscricao.status, 'EM_AVALIACAO');
      await this.inscricoes.update({ ...inscricao, status: 'EM_AVALIACAO', atualizadoEm: now });
    }

    await this.notifier.notify(novos, {
      tipo: 'AVALIACAO_ATRIBUIDA',
      titulo: 'Nova proposta para avaliar',
      mensagem: `A proposta "${inscricao.titulo}" (protocolo ${inscricao.protocolo}) foi atribuída a você.`,
      referenceId: inscricaoId,
    });
    return criadas;
  }

  /** Remove uma atribuição ainda pendente (redistribuição pelo gestor). */
  async removerAtribuicao(avaliacaoId: string): Promise<void> {
    const avaliacao = await this.getById(avaliacaoId);
    if (avaliacao.status !== 'PENDENTE') {
      throw new UnprocessableEntityError('Pareceres concluídos não podem ser removidos.');
    }
    await this.avaliacoes.delete(avaliacaoId);

    const restantes = await this.avaliacoes.list({ inscricaoId: avaliacao.inscricaoId });
    const inscricao = await this.getInscricao(avaliacao.inscricaoId);
    if (inscricao.status === 'EM_AVALIACAO') {
      const novoStatus: InscricaoStatus =
        restantes.length === 0
          ? 'SUBMETIDA'
          : restantes.every((a) => a.status === 'CONCLUIDA')
            ? 'AVALIADA'
            : 'EM_AVALIACAO';
      if (novoStatus !== inscricao.status) {
        await this.inscricoes.update({ ...inscricao, status: novoStatus, atualizadoEm: this.clock.now() });
      }
    }
  }

  // ── Avaliador (S4.2 / S4.3) ─────────────────────────────────────────────

  minhas(avaliadorId: string): Promise<Avaliacao[]> {
    return this.avaliacoes.list({ avaliadorId });
  }

  async getForActor(avaliacaoId: string, actor: AuthenticatedUser): Promise<Avaliacao> {
    const avaliacao = await this.getById(avaliacaoId);
    if (avaliacao.avaliadorId !== actor.id && !isGestorRole(actor.role)) {
      throw new NotFoundError('Avaliação não encontrada.');
    }
    return avaliacao;
  }

  async emitirParecer(
    avaliacaoId: string,
    avaliadorId: string,
    notas: readonly NotaCriterio[],
    parecer: string,
  ): Promise<Avaliacao> {
    const avaliacao = await this.getById(avaliacaoId);
    if (avaliacao.avaliadorId !== avaliadorId) {
      throw new NotFoundError('Avaliação não encontrada.');
    }
    if (avaliacao.status === 'CONCLUIDA') {
      throw new UnprocessableEntityError('Este parecer já foi enviado e não pode ser alterado.');
    }
    const inscricao = await this.getInscricao(avaliacao.inscricaoId);
    const edital = await this.editais.findById(inscricao.editalId);
    if (!edital) throw new NotFoundError('Edital da proposta não encontrado.');

    const notaFinal = calcularNotaFinal(notas);
    assertParecer(notaFinal, edital.notaCorte, parecer);

    const now = this.clock.now();
    const saved = await this.avaliacoes.update({
      ...avaliacao,
      status: 'CONCLUIDA',
      notas: notas.map((n) => ({ ...n })),
      notaFinal,
      parecer: parecer.trim(),
      concluidaEm: now,
    });

    const todas = await this.avaliacoes.list({ inscricaoId: inscricao.id });
    if (inscricao.status === 'EM_AVALIACAO' && todas.every((a) => a.status === 'CONCLUIDA')) {
      assertInscricaoTransition(inscricao.status, 'AVALIADA');
      await this.inscricoes.update({ ...inscricao, status: 'AVALIADA', atualizadoEm: now });
    }
    return saved;
  }

  // ── Ranking e homologação (S4.4 / S5) ───────────────────────────────────

  /** Propostas avaliadas de um edital ordenadas pela média, com a cota de cada subárea. */
  async ranking(editalId: string): Promise<ItemTriagem[]> {
    const itens = await this.fila({ editalId });
    return itens
      .filter((i) => ['AVALIADA', 'APROVADA', 'RECUSADA'].includes(i.inscricao.status))
      .sort((a, b) => (b.consolidado.media ?? -1) - (a.consolidado.media ?? -1));
  }

  async homologar(
    inscricaoId: string,
    decisao: 'APROVAR' | 'RECUSAR',
    justificativa: string,
  ): Promise<Inscricao> {
    const inscricao = await this.getInscricao(inscricaoId);
    const alvo: InscricaoStatus = decisao === 'APROVAR' ? 'APROVADA' : 'RECUSADA';
    assertInscricaoTransition(inscricao.status, alvo);

    if (decisao === 'RECUSAR' && justificativa.trim().length < 10) {
      throw new ValidationError('Justifique a recusa (mínimo de 10 caracteres).');
    }
    const now = this.clock.now();
    const homologada: Inscricao = {
      ...inscricao,
      status: alvo,
      homologacaoJustificativa: justificativa.trim() || null,
      homologadaEm: now,
      atualizadoEm: now,
    };

    let saved: Inscricao;
    if (decisao === 'APROVAR') {
      const edital = await this.editais.findById(inscricao.editalId);
      if (!edital) throw new NotFoundError('Edital da proposta não encontrado.');
      const limite = edital.cotas.find((c) => c.subareaCode === inscricao.subareaCode)?.quantidade ?? 0;
      // Contagem e gravação na mesma transação: aprovações simultâneas não estouram a cota.
      const resultado = await this.inscricoes.aprovarDentroDaCota(homologada, limite);
      if (!resultado.salva) {
        assertCotaDisponivel(edital, inscricao.subareaCode, resultado.aprovadas);
      }
      saved = resultado.salva as Inscricao;
    } else {
      saved = await this.inscricoes.update(homologada);
    }

    // RF18 — discente e orientador recebem o resultado.
    await this.notifier.notify(
      [saved.discenteId, ...(saved.orientadorId ? [saved.orientadorId] : [])],
      {
        tipo: 'INSCRICAO_RESULTADO',
        titulo: alvo === 'APROVADA' ? 'Proposta aprovada' : 'Proposta não aprovada',
        mensagem:
          alvo === 'APROVADA'
            ? `A proposta "${saved.titulo}" foi aprovada. O projeto já está disponível em Meus Projetos.`
            : `A proposta "${saved.titulo}" não foi aprovada. Justificativa: ${saved.homologacaoJustificativa}`,
        referenceId: saved.id,
      },
    );
    return saved;
  }

  private async getById(id: string): Promise<Avaliacao> {
    const avaliacao = await this.avaliacoes.findById(id);
    if (!avaliacao) throw new NotFoundError('Avaliação não encontrada.');
    return avaliacao;
  }

  private async getInscricao(id: string): Promise<Inscricao> {
    const inscricao = await this.inscricoes.findById(id);
    if (!inscricao) throw new NotFoundError(`Inscrição ${id} não encontrada.`);
    return inscricao;
  }
}
