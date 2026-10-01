import { randomUUID } from 'node:crypto';

import { isGestorRole, type AuthenticatedUser } from '@shared/auth/auth.types';
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '@shared/errors/domain.errors';
import type { Notifier } from '@shared/events/notifier';
import {
  assertPdfValido,
  sanitizeNomeArquivo,
  type ArquivoStorage,
} from '@shared/storage/arquivo.storage';
import type { Clock } from '@shared/time/clock';

import type { Inscricao } from '../inscricoes/domain/inscricoes.types';
import type { InscricoesRepository } from '../inscricoes/repositories/inscricoes.repository';
import type { InscricoesService } from '../inscricoes/inscricoes.service';

import {
  gerarCsv,
  mascararMatricula,
  prazoRelatorio,
  proximaVersao,
  situacaoRelatorio,
} from './domain/projetos.rules';
import {
  RELATORIO_TIPOS,
  type Relatorio,
  type RelatorioTipo,
  type SituacaoRelatorio,
} from './domain/projetos.types';
import type { RelatoriosRepository } from './repositories/relatorios.repository';

export interface AcompanhamentoRelatorio {
  tipo: RelatorioTipo;
  prazo: Date;
  situacao: SituacaoRelatorio;
}

export interface EventoTimeline {
  data: Date;
  titulo: string;
  descricao: string;
}

export interface ProjetoDetalhe {
  inscricao: Inscricao;
  relatorios: Relatorio[];
  acompanhamento: AcompanhamentoRelatorio[];
  timeline: EventoTimeline[];
}

/**
 * Projeto = inscrição APROVADA (RF19). Este serviço cuida do acompanhamento:
 * relatórios parciais/finais com versões (RF20/RF21) e exportação (RF22).
 */
export class ProjetosService {
  constructor(
    private readonly inscricoes: InscricoesRepository,
    private readonly inscricoesService: InscricoesService,
    private readonly relatorios: RelatoriosRepository,
    private readonly storage: ArquivoStorage,
    private readonly clock: Clock,
    private readonly notifier: Notifier,
  ) {}

  /** Discente vê os seus; docente, os que orienta; gestor, todos. */
  listForActor(actor: AuthenticatedUser): Promise<Inscricao[]> {
    if (isGestorRole(actor.role)) {
      return this.inscricoes.list({ status: ['APROVADA'] });
    }
    if (actor.role === 'DOCENTE') {
      return this.inscricoes.list({ status: ['APROVADA'], orientadorId: actor.id });
    }
    return this.inscricoes.list({ status: ['APROVADA'], discenteId: actor.id });
  }

  async detalhe(id: string, actor: AuthenticatedUser): Promise<ProjetoDetalhe> {
    const inscricao = await this.getProjetoForActor(id, actor);
    const relatorios = await this.relatorios.listByInscricao(id);
    return {
      inscricao,
      relatorios,
      acompanhamento: this.acompanhamento(inscricao, relatorios),
      timeline: this.timeline(inscricao, relatorios),
    };
  }

  async enviarRelatorio(
    id: string,
    discenteId: string,
    tipo: RelatorioTipo,
    nomeOriginal: string,
    content: Buffer,
  ): Promise<Relatorio> {
    const inscricao = await this.getProjeto(id);
    if (inscricao.discenteId !== discenteId) {
      throw new ForbiddenError('Apenas o bolsista do projeto envia relatórios.');
    }
    const nome = sanitizeNomeArquivo(nomeOriginal);
    assertPdfValido(content, nome);

    const existentes = await this.relatorios.listByInscricao(id);
    const versao = proximaVersao(existentes, tipo);

    const storageKey = randomUUID();
    await this.storage.save(storageKey, content);
    const relatorio = await this.relatorios.create({
      id: randomUUID(),
      inscricaoId: id,
      tipo,
      versao,
      status: 'ENVIADO',
      comentarioOrientador: null,
      storageKey,
      nome,
      tamanho: content.length,
      mimeType: 'application/pdf',
      enviadoEm: this.clock.now(),
      avaliadoEm: null,
    });

    if (inscricao.orientadorId) {
      await this.notifier.notify([inscricao.orientadorId], {
        tipo: 'RELATORIO_ENVIADO',
        titulo: `Relatório ${tipo === 'PARCIAL' ? 'parcial' : 'final'} recebido`,
        mensagem: `O bolsista enviou a versão ${versao} do relatório ${tipo.toLowerCase()} do projeto "${inscricao.titulo}". Analise e aprove ou devolva com comentários.`,
        referenceId: inscricao.id,
      });
    }
    return relatorio;
  }

  async avaliarRelatorio(
    id: string,
    orientadorId: string,
    relatorioId: string,
    decisao: 'APROVAR' | 'DEVOLVER',
    comentario: string,
  ): Promise<Relatorio> {
    const inscricao = await this.getProjeto(id);
    if (inscricao.orientadorId !== orientadorId) {
      throw new ForbiddenError('Apenas o orientador do projeto avalia os relatórios.');
    }
    const relatorio = await this.relatorios.findById(relatorioId);
    if (!relatorio || relatorio.inscricaoId !== id) {
      throw new NotFoundError('Relatório não encontrado.');
    }
    if (relatorio.status !== 'ENVIADO') {
      throw new UnprocessableEntityError('Esta versão do relatório já foi avaliada.');
    }
    if (decisao === 'DEVOLVER' && comentario.trim().length < 10) {
      throw new ValidationError('Explique o que precisa ser corrigido (mínimo de 10 caracteres).');
    }

    const saved = await this.relatorios.update({
      ...relatorio,
      status: decisao === 'APROVAR' ? 'APROVADO' : 'DEVOLVIDO',
      comentarioOrientador: comentario.trim() || null,
      avaliadoEm: this.clock.now(),
    });

    await this.notifier.notify([inscricao.discenteId], {
      tipo: 'RELATORIO_AVALIADO',
      titulo: decisao === 'APROVAR' ? 'Relatório aprovado' : 'Relatório devolvido para correção',
      mensagem:
        decisao === 'APROVAR'
          ? `Seu orientador aprovou o relatório ${relatorio.tipo.toLowerCase()} (versão ${relatorio.versao}).`
          : `Seu orientador pediu correções no relatório ${relatorio.tipo.toLowerCase()}: ${saved.comentarioOrientador}`,
      referenceId: inscricao.id,
    });
    return saved;
  }

  async lerRelatorio(
    id: string,
    actor: AuthenticatedUser,
    relatorioId: string,
  ): Promise<{ nome: string; content: Buffer }> {
    await this.getProjetoForActor(id, actor);
    const relatorio = await this.relatorios.findById(relatorioId);
    if (!relatorio || relatorio.inscricaoId !== id) {
      throw new NotFoundError('Relatório não encontrado.');
    }
    return { nome: relatorio.nome, content: await this.storage.read(relatorio.storageKey) };
  }

  /** RF22 — CSV para prestação de contas, com matrícula mascarada (RN09). */
  async exportarCsv(editalId?: string): Promise<string> {
    const projetos = await this.inscricoes.list({ status: ['APROVADA'], editalId });
    const views = await this.inscricoesService.views(projetos);
    const relatorios = await this.relatorios.list();

    const linhas = views.map(({ inscricao, edital, discente, orientador }) => {
      const doProjeto = relatorios.filter((r) => r.inscricaoId === inscricao.id);
      const [parcial, final] = this.acompanhamento(inscricao, doProjeto);
      return [
        inscricao.protocolo ?? '',
        edital?.numero ?? '',
        edital?.tipoBolsa ?? '',
        inscricao.titulo,
        `${inscricao.subareaCode} ${inscricao.subareaNome}`,
        discente?.nome ?? '',
        mascararMatricula(discente?.matricula ?? null),
        orientador?.nome ?? '',
        orientador?.departamento ?? '',
        inscricao.homologadaEm?.toISOString().slice(0, 10) ?? '',
        parcial?.situacao ?? '',
        final?.situacao ?? '',
      ];
    });

    return gerarCsv(
      [
        'Protocolo',
        'Edital',
        'Bolsa',
        'Título',
        'Subárea CNPq',
        'Bolsista',
        'Matrícula',
        'Orientador',
        'Departamento',
        'Homologado em',
        'Relatório parcial',
        'Relatório final',
      ],
      linhas,
    );
  }

  private acompanhamento(inscricao: Inscricao, relatorios: readonly Relatorio[]): AcompanhamentoRelatorio[] {
    const base = inscricao.homologadaEm ?? inscricao.atualizadoEm;
    const agora = this.clock.now();
    return RELATORIO_TIPOS.map((tipo) => {
      const prazo = prazoRelatorio(base, tipo);
      return { tipo, prazo, situacao: situacaoRelatorio(relatorios, tipo, prazo, agora) };
    });
  }

  /** Histórico do bolsista (S6): eventos derivados das datas do agregado. */
  private timeline(inscricao: Inscricao, relatorios: readonly Relatorio[]): EventoTimeline[] {
    const eventos: EventoTimeline[] = [
      { data: inscricao.criadoEm, titulo: 'Inscrição iniciada', descricao: 'Rascunho criado pelo discente.' },
    ];
    if (inscricao.submetidaEm) {
      eventos.push({
        data: inscricao.submetidaEm,
        titulo: 'Proposta submetida',
        descricao: `Protocolo ${inscricao.protocolo}.`,
      });
    }
    if (inscricao.homologadaEm) {
      eventos.push({
        data: inscricao.homologadaEm,
        titulo: 'Proposta aprovada',
        descricao: 'Bolsa homologada pela gestão.',
      });
    }
    for (const r of relatorios) {
      const rotulo = `Relatório ${r.tipo === 'PARCIAL' ? 'parcial' : 'final'} v${r.versao}`;
      eventos.push({ data: r.enviadoEm, titulo: `${rotulo} enviado`, descricao: r.nome });
      if (r.avaliadoEm) {
        eventos.push({
          data: r.avaliadoEm,
          titulo: `${rotulo} ${r.status === 'APROVADO' ? 'aprovado' : 'devolvido'}`,
          descricao: r.comentarioOrientador ?? 'Sem comentários do orientador.',
        });
      }
    }
    return eventos.sort((a, b) => a.data.getTime() - b.data.getTime());
  }

  private async getProjeto(id: string): Promise<Inscricao> {
    const inscricao = await this.inscricoes.findById(id);
    if (!inscricao || inscricao.status !== 'APROVADA') {
      throw new NotFoundError('Projeto não encontrado.');
    }
    return inscricao;
  }

  private async getProjetoForActor(id: string, actor: AuthenticatedUser): Promise<Inscricao> {
    const inscricao = await this.getProjeto(id);
    const permitido =
      isGestorRole(actor.role) || inscricao.discenteId === actor.id || inscricao.orientadorId === actor.id;
    if (!permitido) {
      throw new NotFoundError('Projeto não encontrado.');
    }
    return inscricao;
  }
}
