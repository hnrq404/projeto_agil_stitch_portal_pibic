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
  assertIndicacaoAvaliadores,
  assertParecer,
  assertQuantidadeAvaliadores,
  avaliacaoCompleta,
  calcularNotaFinal,
  consolidar,
  motivoConflito,
} from './domain/avaliacoes.rules';
import type { Avaliacao, Consolidado, NotaCriterio } from './domain/avaliacoes.types';
import type { AvaliacoesRepository } from './repositories/avaliacoes.repository';

/** Status que aparecem na central de triagem (rascunhos e projetos em divulgação ficam de fora). */
export const STATUS_TRIAGEM: readonly InscricaoStatus[] = [
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

  // ── Porta usada pelo módulo de inscrições ───────────────────────────────

  async isAvaliadorDe(inscricaoId: string, avaliadorId: string): Promise<boolean> {
    const atribuidas = await this.avaliacoes.list({ inscricaoId, avaliadorId });
    return atribuidas.length > 0;
  }

  /**
   * Valida os três avaliadores indicados pelo professor no envio ao edital:
   * docentes cadastrados, distintos e sem conflito de interesse. Não grava nada.
   */
  async validarIndicacao(inscricao: Inscricao, avaliadorIds: readonly string[]): Promise<void> {
    assertIndicacaoAvaliadores(avaliadorIds);
    await this.assertDocentesSemConflito(inscricao, avaliadorIds);
  }

  /** Cria as avaliações do envio ao edital e avisa cada avaliador. Chamar após validarIndicacao. */
  async atribuirNaSubmissao(inscricao: Inscricao, avaliadorIds: readonly string[]): Promise<Avaliacao[]> {
    return this.criarAvaliacoes(inscricao, avaliadorIds);
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

  /**
   * Substituição pela gestão: completa os três avaliadores de um projeto em
   * avaliação (ex.: depois de remover um professor que não respondeu).
   */
  async atribuir(inscricaoId: string, avaliadorIds: readonly string[]): Promise<Avaliacao[]> {
    const inscricao = await this.getInscricao(inscricaoId);
    if (inscricao.status !== 'EM_AVALIACAO') {
      throw new UnprocessableEntityError('Só é possível trocar avaliadores de projetos em avaliação.', {
        status: inscricao.status,
      });
    }

    const existentes = await this.avaliacoes.list({ inscricaoId });
    const novos = [...new Set(avaliadorIds)].filter(
      (id) => !existentes.some((a) => a.avaliadorId === id),
    );
    if (novos.length === 0) {
      throw new ValidationError('Selecione ao menos um professor ainda não atribuído.');
    }
    assertQuantidadeAvaliadores(existentes.length, novos.length);
    await this.assertDocentesSemConflito(inscricao, novos);
    return this.criarAvaliacoes(inscricao, novos);
  }

  /** Remove uma atribuição ainda pendente; o projeto segue em avaliação até completar três pareceres. */
  async removerAtribuicao(avaliacaoId: string): Promise<void> {
    const avaliacao = await this.getById(avaliacaoId);
    if (avaliacao.status !== 'PENDENTE') {
      throw new UnprocessableEntityError('Pareceres concluídos não podem ser removidos.');
    }
    await this.avaliacoes.delete(avaliacaoId);
  }

  // ── Professor avaliador (S4.2 / S4.3) ───────────────────────────────────

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
    if (!edital) throw new NotFoundError('Edital do projeto não encontrado.');

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
    if (inscricao.status === 'EM_AVALIACAO' && avaliacaoCompleta(todas)) {
      assertInscricaoTransition(inscricao.status, 'AVALIADA');
      await this.inscricoes.update({ ...inscricao, status: 'AVALIADA', atualizadoEm: now });
    }
    return saved;
  }

  // ── Ranking e homologação (S4.4 / S5) ───────────────────────────────────

  /** Projetos avaliados de um edital ordenados pela média, com a cota de cada subárea. */
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
      if (!edital) throw new NotFoundError('Edital do projeto não encontrado.');
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

    // RF18 — aluno e professor recebem o resultado da aprovação.
    await this.notifier.notify(
      [...(saved.discenteId ? [saved.discenteId] : []), saved.orientadorId],
      {
        tipo: 'INSCRICAO_RESULTADO',
        titulo: alvo === 'APROVADA' ? 'Projeto aprovado' : 'Projeto não aprovado',
        mensagem:
          alvo === 'APROVADA'
            ? `O projeto "${saved.titulo}" foi aprovado no edital. A bolsa começa agora: o relatório mensal vence todo dia 5, em Projetos.`
            : `O projeto "${saved.titulo}" não foi aprovado. Justificativa: ${saved.homologacaoJustificativa}`,
        referenceId: saved.id,
      },
    );
    return saved;
  }

  private async assertDocentesSemConflito(inscricao: Inscricao, avaliadorIds: readonly string[]): Promise<void> {
    const docentes = await this.usuarios.findManyByIds(avaliadorIds);
    for (const id of avaliadorIds) {
      const docente = docentes.find((d) => d.id === id);
      if (!docente || docente.role !== 'DOCENTE') {
        throw new ValidationError('Os avaliadores precisam ser professores cadastrados no portal.', {
          avaliadorId: id,
        });
      }
      const conflito = motivoConflito(id, inscricao.orientadorId, inscricao.discenteId);
      if (conflito) {
        throw new UnprocessableEntityError(`Conflito de interesse com ${docente.nome}: ${conflito}.`, {
          avaliadorId: id,
        });
      }
    }
  }

  private async criarAvaliacoes(inscricao: Inscricao, avaliadorIds: readonly string[]): Promise<Avaliacao[]> {
    const now = this.clock.now();
    const criadas = await Promise.all(
      avaliadorIds.map((avaliadorId) =>
        this.avaliacoes.create({
          id: randomUUID(),
          inscricaoId: inscricao.id,
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
    await this.notifier.notify(avaliadorIds, {
      tipo: 'AVALIACAO_ATRIBUIDA',
      titulo: 'Novo projeto para avaliar',
      mensagem: `Você foi indicado(a) para avaliar o projeto "${inscricao.titulo}" (protocolo ${inscricao.protocolo}).`,
      referenceId: inscricao.id,
    });
    return criadas;
  }

  private async getById(id: string): Promise<Avaliacao> {
    const avaliacao = await this.avaliacoes.findById(id);
    if (!avaliacao) throw new NotFoundError('Avaliação não encontrada.');
    return avaliacao;
  }

  private async getInscricao(id: string): Promise<Inscricao> {
    const inscricao = await this.inscricoes.findById(id);
    if (!inscricao) throw new NotFoundError(`Projeto ${id} não encontrado.`);
    return inscricao;
  }
}
