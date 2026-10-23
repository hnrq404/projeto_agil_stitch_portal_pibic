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
  assertPdfEnviado,
  sanitizeNomeArquivo,
  type ArquivoStorage,
  type InstrucaoUpload,
} from '@shared/storage/arquivo.storage';
import type { Clock } from '@shared/time/clock';

import type { NotificacaoTipo } from '../notificacoes/domain/notificacoes.types';
import type { Inscricao } from '../inscricoes/domain/inscricoes.types';
import type { InscricoesRepository } from '../inscricoes/repositories/inscricoes.repository';
import type { InscricoesService } from '../inscricoes/inscricoes.service';

import {
  acompanhamento,
  assertCompetenciaEnviavel,
  assertDescricao,
  competenciaDe,
  gerarCsv,
  mascararMatricula,
  nomeCompetencia,
  proximaVersao,
} from './domain/projetos.rules';
import type { AcompanhamentoRelatorio, Relatorio, RelatorioTipo } from './domain/projetos.types';
import type { RelatoriosRepository } from './repositories/relatorios.repository';

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

export interface NovoRelatorioInput {
  tipo: RelatorioTipo;
  /** Obrigatória no mensal ("2026-09"). */
  competencia?: string;
  descricao: string;
}

/** Porta para não repetir lembretes: quem já foi avisado sobre esta referência. */
export interface LembretesPort {
  jaNotificados(tipo: NotificacaoTipo, referenceId: string): Promise<string[]>;
}

/** Atrasos mais antigos que isto não geram aviso novo (evita enxurrada ao ligar o job). */
const JANELA_AVISO_ATRASO_MS = 31 * 24 * 60 * 60 * 1000;

function rotuloRelatorio(tipo: RelatorioTipo, competencia: string): string {
  return tipo === 'MENSAL' ? `relatório de ${nomeCompetencia(competencia)}` : 'relatório final';
}

/**
 * Projeto = inscrição APROVADA (RF19). Este serviço cuida do acompanhamento:
 * relatórios mensais (todo dia 5) e final, com versões (RF20/RF21), lembretes
 * automáticos e exportação (RF22).
 */
export class ProjetosService {
  constructor(
    private readonly inscricoes: InscricoesRepository,
    private readonly inscricoesService: InscricoesService,
    private readonly relatorios: RelatoriosRepository,
    private readonly storage: ArquivoStorage,
    private readonly clock: Clock,
    private readonly notifier: Notifier,
    private readonly lembretes: LembretesPort,
  ) {}

  /** Aluno vê os seus; professor, os que orienta; gestor, todos. */
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
      acompanhamento: acompanhamento(this.inicioVigencia(inscricao), relatorios, this.clock.now()),
      timeline: this.timeline(inscricao, relatorios),
    };
  }

  /** O bolsista envia o texto do relatório; o PDF (opcional no mensal) vem em seguida. */
  async enviarRelatorio(id: string, discenteId: string, input: NovoRelatorioInput): Promise<Relatorio> {
    const inscricao = await this.getProjeto(id);
    if (inscricao.discenteId !== discenteId) {
      throw new ForbiddenError('Apenas o bolsista do projeto envia relatórios.');
    }
    const agora = this.clock.now();
    const competencia = input.tipo === 'MENSAL' ? (input.competencia ?? '') : '';
    if (input.tipo === 'MENSAL') {
      if (!competencia) throw new ValidationError('Informe o mês de referência do relatório.');
      assertCompetenciaEnviavel(competencia, this.inicioVigencia(inscricao), agora);
    }
    assertDescricao(input.tipo, input.descricao);

    const existentes = await this.relatorios.listByInscricao(id);
    const versao = proximaVersao(existentes, input.tipo, competencia);
    const relatorio = await this.relatorios.create({
      id: randomUUID(),
      inscricaoId: id,
      tipo: input.tipo,
      competencia,
      versao,
      status: 'ENVIADO',
      descricao: input.descricao.trim(),
      arquivo: null,
      comentarioOrientador: null,
      enviadoEm: agora,
      avaliadoEm: null,
    });

    await this.notifier.notify([inscricao.orientadorId], {
      tipo: 'RELATORIO_ENVIADO',
      titulo: `Relatório ${input.tipo === 'MENSAL' ? `de ${nomeCompetencia(competencia)}` : 'final'} recebido`,
      mensagem: `O bolsista enviou a versão ${versao} do ${rotuloRelatorio(input.tipo, competencia)} do projeto "${inscricao.titulo}". Analise e aprove ou devolva com comentários.`,
      referenceId: inscricao.id,
    });
    return relatorio;
  }

  /** Primeira etapa do envio do PDF de um relatório: autoriza o upload direto ao armazenamento. */
  async prepararArquivo(
    id: string,
    discenteId: string,
    relatorioId: string,
  ): Promise<{ chave: string; upload: InstrucaoUpload }> {
    const relatorio = await this.getRelatorioEditavel(id, discenteId, relatorioId);
    const chave = `${relatorio.id}-${randomUUID()}`;
    return { chave, upload: await this.storage.prepararUpload(chave) };
  }

  /** Segunda etapa: confere o PDF enviado e anexa (ou troca) no relatório ainda em análise. */
  async anexarArquivo(
    id: string,
    discenteId: string,
    relatorioId: string,
    storageKey: string,
    nomeOriginal: string,
  ): Promise<Relatorio> {
    const relatorio = await this.getRelatorioEditavel(id, discenteId, relatorioId);
    if (!storageKey.startsWith(`${relatorio.id}-`)) {
      throw new ValidationError('Envio de arquivo inválido. Anexe o PDF novamente.');
    }
    if (relatorio.arquivo?.storageKey === storageKey) return relatorio;

    const nome = sanitizeNomeArquivo(nomeOriginal);
    const objeto = await this.storage.inspecionar(storageKey);
    try {
      assertPdfEnviado(objeto);
    } catch (error) {
      if (objeto) await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }

    let saved: Relatorio;
    try {
      saved = await this.relatorios.update({
        ...relatorio,
        arquivo: { storageKey, nome, tamanho: objeto.tamanho, mimeType: 'application/pdf' },
      });
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
    if (relatorio.arquivo) {
      await this.storage.remove(relatorio.arquivo.storageKey);
    }
    return saved;
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
    const relatorio = await this.getRelatorio(id, relatorioId);
    if (relatorio.status !== 'ENVIADO') {
      throw new UnprocessableEntityError('Esta versão do relatório já foi avaliada.');
    }
    if (decisao === 'APROVAR' && relatorio.tipo === 'FINAL' && !relatorio.arquivo) {
      throw new UnprocessableEntityError('O relatório final só pode ser aprovado com o PDF anexado.');
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

    const rotulo = rotuloRelatorio(relatorio.tipo, relatorio.competencia);
    if (inscricao.discenteId) {
      await this.notifier.notify([inscricao.discenteId], {
        tipo: 'RELATORIO_AVALIADO',
        titulo: decisao === 'APROVAR' ? 'Relatório aprovado' : 'Relatório devolvido para correção',
        mensagem:
          decisao === 'APROVAR'
            ? `Seu orientador aprovou o ${rotulo} (versão ${relatorio.versao}).`
            : `Seu orientador pediu correções no ${rotulo}: ${saved.comentarioOrientador}`,
        referenceId: inscricao.id,
      });
    }
    return saved;
  }

  async lerRelatorio(
    id: string,
    actor: AuthenticatedUser,
    relatorioId: string,
  ): Promise<{ nome: string; url: string }> {
    await this.getProjetoForActor(id, actor);
    const relatorio = await this.getRelatorio(id, relatorioId);
    if (!relatorio.arquivo) {
      throw new NotFoundError('Este relatório não tem PDF anexado.');
    }
    const { storageKey, nome } = relatorio.arquivo;
    return { nome, url: await this.storage.urlDeLeitura(storageKey, nome) };
  }

  /** Relatório do próprio bolsista que ainda aceita PDF (em análise). */
  private async getRelatorioEditavel(id: string, discenteId: string, relatorioId: string): Promise<Relatorio> {
    const inscricao = await this.getProjeto(id);
    if (inscricao.discenteId !== discenteId) {
      throw new ForbiddenError('Apenas o bolsista do projeto envia relatórios.');
    }
    const relatorio = await this.getRelatorio(id, relatorioId);
    if (relatorio.status !== 'ENVIADO') {
      throw new UnprocessableEntityError('Este relatório já foi avaliado; envie uma nova versão.');
    }
    return relatorio;
  }

  /**
   * Job periódico (index.ts): lembra o bolsista do relatório do mês anterior
   * antes do dia 5 e avisa bolsista e orientador quando o prazo passa.
   * Idempotente: cada aviso sai uma única vez por mês de referência.
   */
  async enviarLembretes(): Promise<number> {
    const agora = this.clock.now();
    const mesAtual = competenciaDe(agora);
    const projetos = await this.inscricoes.list({ status: ['APROVADA'] });
    const relatorios = await this.relatorios.list({ inscricaoIds: projetos.map((p) => p.id) });
    let enviados = 0;

    for (const projeto of projetos) {
      if (!projeto.discenteId) continue;
      const doProjeto = relatorios.filter((r) => r.inscricaoId === projeto.id);
      const itens = acompanhamento(this.inicioVigencia(projeto), doProjeto, agora).filter(
        (item) => item.tipo === 'MENSAL' && item.competencia < mesAtual,
      );
      for (const item of itens) {
        const referenceId = `${projeto.id}#${item.competencia}`;
        const mes = nomeCompetencia(item.competencia);
        if (item.situacao === 'AGUARDANDO_ENVIO') {
          enviados += await this.avisarUmaVez('RELATORIO_LEMBRETE', referenceId, [projeto.discenteId], {
            titulo: `Relatório de ${mes} vence dia 5`,
            mensagem: `Envie até ${item.prazo.toLocaleDateString('pt-BR', { timeZone: 'America/Recife' })} o relatório mensal do projeto "${projeto.titulo}", contando o que você fez em ${mes}.`,
          });
        } else if (item.situacao === 'ATRASADO' && agora.getTime() - item.prazo.getTime() <= JANELA_AVISO_ATRASO_MS) {
          enviados += await this.avisarUmaVez('RELATORIO_ATRASADO', referenceId, [projeto.discenteId, projeto.orientadorId], {
            titulo: `Relatório de ${mes} em atraso`,
            mensagem: `O relatório mensal de ${mes} do projeto "${projeto.titulo}" não foi enviado até o dia 5. Envie o quanto antes.`,
          });
        }
      }
    }
    return enviados;
  }

  /** RF22 — CSV para prestação de contas, com matrícula mascarada (RN09). */
  async exportarCsv(editalId?: string): Promise<string> {
    const projetos = await this.inscricoes.list({ status: ['APROVADA'], editalId });
    const views = await this.inscricoesService.views(projetos);
    const relatorios = await this.relatorios.list({ inscricaoIds: projetos.map((p) => p.id) });
    const agora = this.clock.now();

    const linhas = views.map(({ inscricao, edital, discente, orientador }) => {
      const doProjeto = relatorios.filter((r) => r.inscricaoId === inscricao.id);
      const itens = acompanhamento(this.inicioVigencia(inscricao), doProjeto, agora);
      const mensais = itens.filter((i) => i.tipo === 'MENSAL');
      const final = itens.find((i) => i.tipo === 'FINAL');
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
        `${mensais.filter((m) => m.situacao === 'APROVADO').length}/${mensais.length}`,
        mensais.filter((m) => m.situacao === 'ATRASADO').length,
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
        'Relatórios mensais aprovados',
        'Relatórios mensais atrasados',
        'Relatório final',
      ],
      linhas,
    );
  }

  private async avisarUmaVez(
    tipo: NotificacaoTipo,
    referenceId: string,
    destinatarios: readonly string[],
    conteudo: { titulo: string; mensagem: string },
  ): Promise<number> {
    const avisados = new Set(await this.lembretes.jaNotificados(tipo, referenceId));
    const faltam = [...new Set(destinatarios)].filter((id) => !avisados.has(id));
    if (faltam.length === 0) return 0;
    await this.notifier.notify(faltam, { tipo, ...conteudo, referenceId });
    return faltam.length;
  }

  private inicioVigencia(inscricao: Inscricao): Date {
    return inscricao.homologadaEm ?? inscricao.atualizadoEm;
  }

  /** Histórico do bolsista (S6): eventos derivados das datas do agregado. */
  private timeline(inscricao: Inscricao, relatorios: readonly Relatorio[]): EventoTimeline[] {
    const eventos: EventoTimeline[] = [
      { data: inscricao.criadoEm, titulo: 'Projeto criado', descricao: 'Rascunho escrito pelo professor.' },
    ];
    if (inscricao.divulgadaEm) {
      eventos.push({ data: inscricao.divulgadaEm, titulo: 'Projeto divulgado', descricao: 'Aberto às candidaturas dos alunos.' });
    }
    if (inscricao.submetidaEm) {
      eventos.push({
        data: inscricao.submetidaEm,
        titulo: 'Enviado ao edital',
        descricao: `Protocolo ${inscricao.protocolo}.`,
      });
    }
    if (inscricao.homologadaEm) {
      eventos.push({
        data: inscricao.homologadaEm,
        titulo: 'Projeto aprovado',
        descricao: 'Bolsa homologada pela gestão.',
      });
    }
    for (const r of relatorios) {
      const rotulo = `${r.tipo === 'MENSAL' ? `Relatório de ${nomeCompetencia(r.competencia)}` : 'Relatório final'} v${r.versao}`;
      eventos.push({ data: r.enviadoEm, titulo: `${rotulo} enviado`, descricao: r.arquivo?.nome ?? 'Sem PDF anexado.' });
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

  private async getRelatorio(projetoId: string, relatorioId: string): Promise<Relatorio> {
    const relatorio = await this.relatorios.findById(relatorioId);
    if (!relatorio || relatorio.inscricaoId !== projetoId) {
      throw new NotFoundError('Relatório não encontrado.');
    }
    return relatorio;
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
