import { randomUUID } from 'node:crypto';

import { isGestorRole, type AuthenticatedUser } from '@shared/auth/auth.types';
import {
  ConflictError,
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

import type { Curriculo, Usuario } from '../auth/domain/auth.types';
import type { UsuariosRepository } from '../auth/repositories/usuarios.repository';
import { isInscricaoAberta } from '../editais/domain/editais.rules';
import type { Edital } from '../editais/domain/editais.types';
import type { EditaisRepository } from '../editais/repositories/editais.repository';

import {
  assertDivulgada,
  assertEditalAceitaInscricoes,
  assertEditavel,
  assertInscricaoTransition,
  gerarProtocolo,
  MIN_MENSAGEM_CANDIDATURA,
  pendenciasParaDivulgacao,
  pendenciasParaSubmissao,
} from './domain/inscricoes.rules';
import type {
  Anexo,
  AnexoTipo,
  Candidatura,
  Inscricao,
  InscricaoFiltro,
  RascunhoInput,
} from './domain/inscricoes.types';
import type { CandidaturasRepository } from './repositories/candidaturas.repository';
import type { InscricoesRepository } from './repositories/inscricoes.repository';

/** Projeto com as entidades relacionadas já resolvidas (para a resposta HTTP). */
export interface InscricaoView {
  inscricao: Inscricao;
  edital: Edital | undefined;
  discente: Usuario | undefined;
  orientador: Usuario | undefined;
}

export interface CandidaturaView {
  candidatura: Candidatura;
  discente: Usuario | undefined;
  projeto: InscricaoView | undefined;
}

/** Porta: o módulo de avaliações cuida dos três avaliadores indicados pelo professor. */
export interface AvaliacoesPort {
  isAvaliadorDe(inscricaoId: string, avaliadorId: string): Promise<boolean>;
  validarIndicacao(inscricao: Inscricao, avaliadorIds: readonly string[]): Promise<void>;
  atribuirNaSubmissao(inscricao: Inscricao, avaliadorIds: readonly string[]): Promise<unknown>;
}

/**
 * Projeto de pesquisa (fluxo UNICAP): o professor escreve e divulga o projeto
 * num edital aberto, os alunos se candidatam, o professor seleciona um aluno e
 * envia ao edital indicando três colegas como avaliadores.
 */
export class InscricoesService {
  constructor(
    private readonly inscricoes: InscricoesRepository,
    private readonly candidaturas: CandidaturasRepository,
    private readonly editais: EditaisRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly storage: ArquivoStorage,
    private readonly clock: Clock,
    private readonly notifier: Notifier,
    private readonly avaliacoes: AvaliacoesPort,
  ) {}

  // ── Leitura ──────────────────────────────────────────────────────────────

  async getById(id: string): Promise<Inscricao> {
    const inscricao = await this.inscricoes.findById(id);
    if (!inscricao) {
      throw new NotFoundError(`Projeto ${id} não encontrado.`);
    }
    return inscricao;
  }

  async getEdital(editalId: string): Promise<Edital> {
    const edital = await this.editais.findById(editalId);
    if (!edital) {
      throw new NotFoundError(`Edital ${editalId} não encontrado.`);
    }
    return edital;
  }

  /** Detalhe com checagem de acesso: professor dono, aluno selecionado, avaliador indicado ou gestor. */
  async getForActor(id: string, actor: AuthenticatedUser): Promise<Inscricao> {
    const inscricao = await this.getById(id);
    if (!(await this.canView(inscricao, actor))) {
      // 404 em vez de 403: não revela a existência de projetos de terceiros.
      throw new NotFoundError(`Projeto ${id} não encontrado.`);
    }
    return inscricao;
  }

  list(filtro: InscricaoFiltro): Promise<Inscricao[]> {
    return this.inscricoes.list(filtro);
  }

  /** Todos os projetos do professor, do rascunho à bolsa. */
  listDoOrientador(orientadorId: string): Promise<Inscricao[]> {
    return this.inscricoes.list({ orientadorId });
  }

  /** Projetos divulgados em editais com inscrições abertas: o que o aluno pode escolher. */
  async listDivulgados(filtro: { editalId?: string; subareaCode?: string } = {}): Promise<Inscricao[]> {
    const divulgados = await this.inscricoes.list({ ...filtro, status: ['DIVULGADA'] });
    const editais = await this.editaisPorId(divulgados);
    return divulgados.filter((i) => {
      const edital = editais.get(i.editalId);
      return edital !== undefined && isInscricaoAberta(edital, this.clock);
    });
  }

  async getDivulgado(id: string): Promise<Inscricao> {
    const inscricao = await this.getById(id);
    if (inscricao.status !== 'DIVULGADA') {
      throw new NotFoundError(`Projeto ${id} não encontrado.`);
    }
    return inscricao;
  }

  async pendencias(inscricao: Inscricao): Promise<string[]> {
    const [edital, aluno] = await Promise.all([
      this.getEdital(inscricao.editalId),
      inscricao.discenteId ? this.usuarios.findById(inscricao.discenteId) : Promise.resolve(undefined),
    ]);
    return pendenciasParaSubmissao(inscricao, edital, { alunoTemCurriculo: Boolean(aluno?.curriculo) });
  }

  /** Resolve edital, aluno e professor de vários projetos com poucas consultas. */
  async views(inscricoes: readonly Inscricao[]): Promise<InscricaoView[]> {
    const userIds = [
      ...new Set(inscricoes.flatMap((i) => [i.orientadorId, ...(i.discenteId ? [i.discenteId] : [])])),
    ];
    const [editais, usuarios] = await Promise.all([this.editaisPorId(inscricoes), this.usuarios.findManyByIds(userIds)]);
    const userById = new Map(usuarios.map((u) => [u.id, u] as const));

    return inscricoes.map((inscricao) => ({
      inscricao,
      edital: editais.get(inscricao.editalId),
      discente: inscricao.discenteId ? userById.get(inscricao.discenteId) : undefined,
      orientador: userById.get(inscricao.orientadorId),
    }));
  }

  async view(inscricao: Inscricao): Promise<InscricaoView> {
    const [view] = await this.views([inscricao]);
    return view as InscricaoView;
  }

  async canView(inscricao: Inscricao, actor: AuthenticatedUser): Promise<boolean> {
    if (isGestorRole(actor.role)) return true;
    if (inscricao.orientadorId === actor.id) return true;
    if (inscricao.discenteId === actor.id) return true;
    if (actor.role === 'DOCENTE') {
      return this.avaliacoes.isAvaliadorDe(inscricao.id, actor.id);
    }
    return false;
  }

  // ── Rascunho do professor ────────────────────────────────────────────────

  async criarRascunho(orientadorId: string, editalId: string): Promise<Inscricao> {
    const edital = await this.getEdital(editalId);
    assertEditalAceitaInscricoes(edital, this.clock);

    const now = this.clock.now();
    return this.inscricoes.create({
      id: randomUUID(),
      protocolo: null,
      editalId,
      discenteId: null,
      orientadorId,
      titulo: '',
      subareaCode: '',
      subareaNome: '',
      palavrasChave: '',
      resumo: '',
      objetivos: '',
      metodologia: '',
      status: 'RASCUNHO',
      anexos: [],
      homologacaoJustificativa: null,
      divulgadaEm: null,
      submetidaEm: null,
      homologadaEm: null,
      criadoEm: now,
      atualizadoEm: now,
    });
  }

  /** Auto-save: aplica apenas os campos enviados (PATCH parcial), até o envio ao edital. */
  async atualizarRascunho(id: string, orientadorId: string, input: RascunhoInput): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, orientadorId);
    assertEditavel(inscricao);

    let subareaNome = inscricao.subareaNome;
    if (input.subareaCode !== undefined && input.subareaCode !== '') {
      const edital = await this.getEdital(inscricao.editalId);
      const cota = edital.cotas.find((c) => c.subareaCode === input.subareaCode);
      if (!cota) {
        throw new ValidationError('A subárea escolhida não tem cotas neste edital.', {
          subareaCode: input.subareaCode,
        });
      }
      subareaNome = cota.subareaNome;
    }

    return this.inscricoes.update({
      ...inscricao,
      titulo: input.titulo ?? inscricao.titulo,
      subareaCode: input.subareaCode ?? inscricao.subareaCode,
      subareaNome: input.subareaCode === '' ? '' : subareaNome,
      palavrasChave: input.palavrasChave ?? inscricao.palavrasChave,
      resumo: input.resumo ?? inscricao.resumo,
      objetivos: input.objetivos ?? inscricao.objetivos,
      metodologia: input.metodologia ?? inscricao.metodologia,
      atualizadoEm: this.clock.now(),
    });
  }

  // ── Anexos (plano de trabalho e Lattes do aluno) ─────────────────────────

  /**
   * Primeira etapa do envio: autoriza o navegador a mandar o PDF direto ao
   * armazenamento. O arquivo só passa a valer depois de `anexar`.
   */
  async prepararAnexo(
    id: string,
    orientadorId: string,
    tipo: AnexoTipo,
  ): Promise<{ chave: string; upload: InstrucaoUpload }> {
    const inscricao = await this.getOwned(id, orientadorId);
    assertEditavel(inscricao);
    assertAnexoDoProfessor(tipo);
    const chave = `${inscricao.id}-${tipo}-${randomUUID()}`;
    return { chave, upload: await this.storage.prepararUpload(chave) };
  }

  /** Segunda etapa: confere o PDF que chegou ao armazenamento e o registra na inscrição. */
  async anexar(
    id: string,
    orientadorId: string,
    tipo: AnexoTipo,
    storageKey: string,
    nomeOriginal: string,
  ): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, orientadorId);
    assertEditavel(inscricao);
    assertAnexoDoProfessor(tipo);
    // Só vale uma chave emitida para esta inscrição e este tipo de anexo.
    if (!storageKey.startsWith(`${inscricao.id}-${tipo}-`)) {
      throw new ValidationError('Envio de arquivo inválido. Anexe o PDF novamente.');
    }

    // Um anexo por tipo: o novo substitui o anterior.
    const anterior = inscricao.anexos.find((a) => a.tipo === tipo);
    if (anterior?.storageKey === storageKey) return inscricao;

    const nome = sanitizeNomeArquivo(nomeOriginal);
    const objeto = await this.storage.inspecionar(storageKey);
    try {
      assertPdfEnviado(objeto);
    } catch (error) {
      // Arquivo recusado não fica ocupando espaço no armazenamento.
      if (objeto) await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }

    let saved: Inscricao;
    try {
      saved = await this.inscricoes.update({
        ...inscricao,
        anexos: [
          ...inscricao.anexos.filter((a) => a.tipo !== tipo),
          {
            id: randomUUID(),
            tipo,
            storageKey,
            nome,
            tamanho: objeto.tamanho,
            mimeType: 'application/pdf',
            enviadoEm: this.clock.now(),
          },
        ],
        atualizadoEm: this.clock.now(),
      });
    } catch (error) {
      // O banco não registrou o anexo: apaga o arquivo para não deixar órfão no storage.
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
    if (anterior) {
      await this.storage.remove(anterior.storageKey);
    }
    return saved;
  }

  async removerAnexo(id: string, orientadorId: string, anexoId: string): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, orientadorId);
    assertEditavel(inscricao);
    const anexo = inscricao.anexos.find((a) => a.id === anexoId);
    if (!anexo) {
      throw new NotFoundError('Anexo não encontrado.');
    }
    const saved = await this.inscricoes.update({
      ...inscricao,
      anexos: inscricao.anexos.filter((a) => a.id !== anexoId),
      atualizadoEm: this.clock.now(),
    });
    await this.storage.remove(anexo.storageKey);
    return saved;
  }

  async lerAnexo(
    id: string,
    actor: AuthenticatedUser,
    anexoId: string,
  ): Promise<{ nome: string; url: string }> {
    const inscricao = await this.getForActor(id, actor);
    const anexo = inscricao.anexos.find((a) => a.id === anexoId);
    if (!anexo) {
      throw new NotFoundError('Anexo não encontrado.');
    }
    return { nome: anexo.nome, url: await this.storage.urlDeLeitura(anexo.storageKey, anexo.nome) };
  }

  // ── Divulgação aos alunos ────────────────────────────────────────────────

  async divulgar(id: string, orientadorId: string): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, orientadorId);
    const edital = await this.getEdital(inscricao.editalId);
    assertEditalAceitaInscricoes(edital, this.clock);

    const pendencias = pendenciasParaDivulgacao(inscricao, edital);
    if (pendencias.length > 0) {
      throw new UnprocessableEntityError('O projeto ainda tem pendências para ser divulgado.', { pendencias });
    }
    assertInscricaoTransition(inscricao.status, 'DIVULGADA');

    const now = this.clock.now();
    const saved = await this.inscricoes.update({ ...inscricao, status: 'DIVULGADA', divulgadaEm: now, atualizadoEm: now });

    const [professor, alunos] = await Promise.all([
      this.usuarios.findById(orientadorId),
      this.usuarios.list('DISCENTE'),
    ]);
    await this.notifier.notify(
      alunos.map((a) => a.id),
      {
        tipo: 'PROJETO_DIVULGADO',
        titulo: 'Novo projeto de pesquisa com vaga',
        mensagem: `${professor?.nome ?? 'Um professor'} divulgou o projeto "${saved.titulo}" (${saved.subareaNome}) no edital ${edital.numero}. Candidate-se até ${edital.dataFimInscricoes.toLocaleDateString('pt-BR')}.`,
        referenceId: saved.id,
      },
    );
    return saved;
  }

  // ── Candidatura do aluno ─────────────────────────────────────────────────

  async candidatar(id: string, discenteId: string, mensagem: string): Promise<CandidaturaView> {
    const inscricao = await this.getById(id);
    assertDivulgada(inscricao);
    assertEditalAceitaInscricoes(await this.getEdital(inscricao.editalId), this.clock);

    if (mensagem.trim().length < MIN_MENSAGEM_CANDIDATURA) {
      throw new ValidationError(
        `Conte ao professor por que você quer participar (mínimo de ${MIN_MENSAGEM_CANDIDATURA} caracteres).`,
      );
    }
    if (await this.candidaturas.findByInscricaoAndDiscente(id, discenteId)) {
      throw new ConflictError('Você já se candidatou a este projeto.');
    }
    // O professor avalia o candidato pelo Lattes; sem ele, a candidatura não ajuda ninguém.
    if (!(await this.usuarios.findById(discenteId))?.curriculo) {
      throw new UnprocessableEntityError('Anexe seu currículo Lattes em "Meu perfil" antes de se candidatar.');
    }
    const selecionadoEm = await this.inscricoes.findByEditalAndDiscente(inscricao.editalId, discenteId);
    if (selecionadoEm) {
      throw new ConflictError('Você já foi selecionado(a) para outro projeto deste edital.', {
        inscricaoId: selecionadoEm.id,
      });
    }

    const candidatura = await this.candidaturas.create({
      id: randomUUID(),
      inscricaoId: id,
      discenteId,
      mensagem: mensagem.trim(),
      status: 'PENDENTE',
      criadoEm: this.clock.now(),
      respondidaEm: null,
    });

    const aluno = await this.usuarios.findById(discenteId);
    await this.notifier.notify([inscricao.orientadorId], {
      tipo: 'CANDIDATURA_RECEBIDA',
      titulo: 'Nova candidatura ao seu projeto',
      mensagem: `${aluno?.nome ?? 'Um aluno'} se candidatou ao projeto "${inscricao.titulo}".`,
      referenceId: inscricao.id,
    });
    const [view] = await this.candidaturaViews([candidatura]);
    return view as CandidaturaView;
  }

  /** O aluno desiste enquanto o professor ainda não decidiu. */
  async cancelarCandidatura(candidaturaId: string, discenteId: string): Promise<void> {
    const candidatura = await this.candidaturas.findById(candidaturaId);
    if (!candidatura || candidatura.discenteId !== discenteId) {
      throw new NotFoundError('Candidatura não encontrada.');
    }
    if (candidatura.status !== 'PENDENTE') {
      throw new UnprocessableEntityError(
        candidatura.status === 'SELECIONADA'
          ? 'Você já foi selecionado(a). Fale com o professor antes de desistir.'
          : 'Esta candidatura já foi encerrada.',
      );
    }
    await this.candidaturas.delete(candidaturaId);
  }

  async minhasCandidaturas(discenteId: string): Promise<CandidaturaView[]> {
    return this.candidaturaViews(await this.candidaturas.list({ discenteId }));
  }

  async candidaturasDoProjeto(id: string, orientadorId: string): Promise<CandidaturaView[]> {
    await this.getOwned(id, orientadorId);
    return this.candidaturaViews(await this.candidaturas.list({ inscricaoId: id }), { semProjeto: true });
  }

  /** O professor escolhe o aluno entre os candidatos (pode trocar até o envio ao edital). */
  async selecionar(id: string, orientadorId: string, candidaturaId: string): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, orientadorId);
    assertDivulgada(inscricao);

    const candidatura = await this.candidaturas.findById(candidaturaId);
    if (!candidatura || candidatura.inscricaoId !== id) {
      throw new NotFoundError('Candidatura não encontrada.');
    }
    if (candidatura.status === 'SELECIONADA') return inscricao;

    const outroProjeto = await this.inscricoes.findByEditalAndDiscente(inscricao.editalId, candidatura.discenteId);
    if (outroProjeto && outroProjeto.id !== id) {
      throw new ConflictError('Este aluno já foi selecionado para outro projeto deste edital.', {
        inscricaoId: outroProjeto.id,
      });
    }

    const now = this.clock.now();
    const anterior = (await this.candidaturas.list({ inscricaoId: id, status: 'SELECIONADA' }))[0];
    if (anterior) {
      await this.candidaturas.update({ ...anterior, status: 'PENDENTE', respondidaEm: null });
    }
    await this.candidaturas.update({ ...candidatura, status: 'SELECIONADA', respondidaEm: now });
    const saved = await this.inscricoes.update({ ...inscricao, discenteId: candidatura.discenteId, atualizadoEm: now });

    if (anterior) {
      await this.notifier.notify([anterior.discenteId], {
        tipo: 'CANDIDATURA_RESULTADO',
        titulo: 'Seleção alterada pelo professor',
        mensagem: `O professor escolheu outro aluno para o projeto "${saved.titulo}". Sua candidatura voltou a ficar em análise.`,
        referenceId: saved.id,
      });
    }
    await this.notifier.notify([candidatura.discenteId], {
      tipo: 'CANDIDATURA_RESULTADO',
      titulo: 'Você foi selecionado(a)',
      mensagem: `O professor selecionou você para o projeto "${saved.titulo}". Ele vai enviar o projeto ao edital; você será avisado(a) do resultado.`,
      referenceId: saved.id,
    });
    return saved;
  }

  // ── Envio ao edital ──────────────────────────────────────────────────────

  /** O professor envia o projeto com o aluno selecionado e indica três colegas como avaliadores. */
  async submeter(id: string, orientadorId: string, avaliadorIds: readonly string[]): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, orientadorId);
    assertEditavel(inscricao);
    const edital = await this.getEdital(inscricao.editalId);
    assertEditalAceitaInscricoes(edital, this.clock);

    const aluno = inscricao.discenteId ? await this.usuarios.findById(inscricao.discenteId) : undefined;
    const pendencias = pendenciasParaSubmissao(inscricao, edital, { alunoTemCurriculo: Boolean(aluno?.curriculo) });
    if (pendencias.length > 0) {
      throw new UnprocessableEntityError('O projeto ainda tem pendências.', { pendencias });
    }
    assertInscricaoTransition(inscricao.status, 'EM_AVALIACAO');
    await this.avaliacoes.validarIndicacao(inscricao, avaliadorIds);

    const now = this.clock.now();
    const protocolo =
      inscricao.protocolo ??
      gerarProtocolo(await this.inscricoes.proximoSequencialProtocolo(now.getUTCFullYear()), now.getUTCFullYear());

    // Congela o Lattes do aluno: os avaliadores veem exatamente o que foi enviado,
    // mesmo que o aluno troque o currículo do perfil depois.
    const copia = aluno?.curriculo ? await this.copiarCurriculo(inscricao, aluno.curriculo, now) : undefined;
    const lattesAnterior = copia ? inscricao.anexos.find((a) => a.tipo === 'LATTES') : undefined;
    let saved: Inscricao;
    try {
      saved = await this.inscricoes.update({
        ...inscricao,
        anexos: copia ? [...inscricao.anexos.filter((a) => a.tipo !== 'LATTES'), copia] : inscricao.anexos,
        protocolo,
        status: 'EM_AVALIACAO',
        submetidaEm: now,
        atualizadoEm: now,
      });
    } catch (error) {
      if (copia) await this.storage.remove(copia.storageKey).catch(() => undefined);
      throw error;
    }
    if (lattesAnterior) await this.storage.remove(lattesAnterior.storageKey).catch(() => undefined);
    await this.avaliacoes.atribuirNaSubmissao(saved, avaliadorIds);

    // Candidatos que não foram escolhidos recebem a resposta agora.
    const naoSelecionados = await this.candidaturas.list({ inscricaoId: id, status: 'PENDENTE' });
    await Promise.all(
      naoSelecionados.map((c) => this.candidaturas.update({ ...c, status: 'NAO_SELECIONADA', respondidaEm: now })),
    );
    if (naoSelecionados.length > 0) {
      await this.notifier.notify(
        naoSelecionados.map((c) => c.discenteId),
        {
          tipo: 'CANDIDATURA_RESULTADO',
          titulo: 'Candidatura não selecionada',
          mensagem: `O professor escolheu outro aluno para o projeto "${saved.titulo}". Veja outros projetos com vaga.`,
          referenceId: saved.id,
        },
      );
    }

    await this.notifier.notify([saved.discenteId as string], {
      tipo: 'PROJETO_ENVIADO',
      titulo: 'Projeto enviado ao edital',
      mensagem: `O projeto "${saved.titulo}" foi enviado ao edital ${edital.numero} (protocolo ${protocolo}) e está em avaliação. Você será avisado(a) do resultado.`,
      referenceId: saved.id,
    });
    return saved;
  }

  /** O professor lê o Lattes de quem se candidatou ao projeto dele. */
  async curriculoDoCandidato(
    id: string,
    orientadorId: string,
    candidaturaId: string,
  ): Promise<{ nome: string; url: string }> {
    await this.getOwned(id, orientadorId);
    const candidatura = await this.candidaturas.findById(candidaturaId);
    if (!candidatura || candidatura.inscricaoId !== id) {
      throw new NotFoundError('Candidatura não encontrada neste projeto.');
    }
    const curriculo = (await this.usuarios.findById(candidatura.discenteId))?.curriculo;
    if (!curriculo) throw new NotFoundError('Este aluno ainda não anexou o currículo Lattes.');
    return { nome: curriculo.nome, url: await this.storage.urlDeLeitura(curriculo.storageKey, curriculo.nome) };
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  private async copiarCurriculo(inscricao: Inscricao, curriculo: Curriculo, agora: Date): Promise<Anexo> {
    const storageKey = `${inscricao.id}-LATTES-${randomUUID()}`;
    await this.storage.copiar(curriculo.storageKey, storageKey);
    return {
      id: randomUUID(),
      tipo: 'LATTES',
      storageKey,
      nome: curriculo.nome,
      tamanho: curriculo.tamanho,
      mimeType: 'application/pdf',
      enviadoEm: agora,
    };
  }

  private async getOwned(id: string, orientadorId: string): Promise<Inscricao> {
    const inscricao = await this.getById(id);
    if (inscricao.orientadorId !== orientadorId) {
      throw new NotFoundError(`Projeto ${id} não encontrado.`);
    }
    return inscricao;
  }

  private async editaisPorId(inscricoes: readonly Inscricao[]): Promise<Map<string, Edital>> {
    const ids = [...new Set(inscricoes.map((i) => i.editalId))];
    const editais = await Promise.all(ids.map((id) => this.editais.findById(id)));
    return new Map(editais.flatMap((e) => (e ? [[e.id, e] as const] : [])));
  }

  private async candidaturaViews(
    candidaturas: readonly Candidatura[],
    opcoes: { semProjeto?: boolean } = {},
  ): Promise<CandidaturaView[]> {
    const [alunos, projetos] = await Promise.all([
      this.usuarios.findManyByIds([...new Set(candidaturas.map((c) => c.discenteId))]),
      opcoes.semProjeto
        ? Promise.resolve([] as InscricaoView[])
        : Promise.all([...new Set(candidaturas.map((c) => c.inscricaoId))].map((id) => this.inscricoes.findById(id))).then(
            (encontrados) => this.views(encontrados.filter((i): i is Inscricao => i !== undefined)),
          ),
    ]);
    const alunoById = new Map(alunos.map((a) => [a.id, a] as const));
    const projetoById = new Map(projetos.map((p) => [p.inscricao.id, p] as const));
    return candidaturas.map((candidatura) => ({
      candidatura,
      discente: alunoById.get(candidatura.discenteId),
      projeto: projetoById.get(candidatura.inscricaoId),
    }));
  }
}

/** O Lattes agora vem do perfil do aluno; o professor anexa só o plano de trabalho. */
function assertAnexoDoProfessor(tipo: AnexoTipo): void {
  if (tipo !== 'PLANO_TRABALHO') {
    throw new UnprocessableEntityError(
      'O currículo Lattes agora é enviado pelo próprio aluno, no perfil dele, e entra no projeto automaticamente no envio ao edital.',
    );
  }
}
