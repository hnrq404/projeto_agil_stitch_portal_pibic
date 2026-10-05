import { randomUUID } from 'node:crypto';

import { isGestorRole, type AuthenticatedUser } from '@shared/auth/auth.types';
import {
  ConflictError,
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

import type { Usuario } from '../auth/domain/auth.types';
import type { UsuariosRepository } from '../auth/repositories/usuarios.repository';
import type { Edital } from '../editais/domain/editais.types';
import type { EditaisRepository } from '../editais/repositories/editais.repository';

import {
  assertEditalAceitaInscricoes,
  assertEditavel,
  assertInscricaoTransition,
  gerarProtocolo,
  pendenciasParaSubmissao,
} from './domain/inscricoes.rules';
import type {
  AnexoTipo,
  Inscricao,
  InscricaoFiltro,
  RascunhoInput,
} from './domain/inscricoes.types';
import type { InscricoesRepository } from './repositories/inscricoes.repository';

/** Inscrição com as entidades relacionadas já resolvidas (para a resposta HTTP). */
export interface InscricaoView {
  inscricao: Inscricao;
  edital: Edital | undefined;
  discente: Usuario | undefined;
  orientador: Usuario | undefined;
}

/** Porta: o módulo de avaliações informa se um avaliador foi designado à inscrição. */
export interface AvaliadorAccessPort {
  isAvaliadorDe(inscricaoId: string, avaliadorId: string): Promise<boolean>;
}

export class InscricoesService {
  constructor(
    private readonly inscricoes: InscricoesRepository,
    private readonly editais: EditaisRepository,
    private readonly usuarios: UsuariosRepository,
    private readonly storage: ArquivoStorage,
    private readonly clock: Clock,
    private readonly notifier: Notifier,
    private readonly avaliadorAccess: AvaliadorAccessPort,
  ) {}

  // ── Leitura ──────────────────────────────────────────────────────────────

  async getById(id: string): Promise<Inscricao> {
    const inscricao = await this.inscricoes.findById(id);
    if (!inscricao) {
      throw new NotFoundError(`Inscrição ${id} não encontrada.`);
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

  /** Detalhe com checagem de acesso: dono, orientador, avaliador designado ou gestor. */
  async getForActor(id: string, actor: AuthenticatedUser): Promise<Inscricao> {
    const inscricao = await this.getById(id);
    if (!(await this.canView(inscricao, actor))) {
      // 404 em vez de 403: não revela a existência de inscrições de terceiros.
      throw new NotFoundError(`Inscrição ${id} não encontrada.`);
    }
    return inscricao;
  }

  list(filtro: InscricaoFiltro): Promise<Inscricao[]> {
    return this.inscricoes.list(filtro);
  }

  /** Orientador vê as inscrições em que foi indicado, a partir da submissão. */
  async listDoOrientador(orientadorId: string): Promise<Inscricao[]> {
    const todas = await this.inscricoes.list({ orientadorId });
    return todas.filter((i) => i.status !== 'RASCUNHO' || i.vinculoStatus === 'RECUSADO');
  }

  async pendencias(inscricao: Inscricao): Promise<string[]> {
    const edital = await this.getEdital(inscricao.editalId);
    return pendenciasParaSubmissao(inscricao, edital);
  }

  /** Resolve edital, discente e orientador de várias inscrições com poucas consultas. */
  async views(inscricoes: readonly Inscricao[]): Promise<InscricaoView[]> {
    const editalIds = [...new Set(inscricoes.map((i) => i.editalId))];
    const userIds = [
      ...new Set(inscricoes.flatMap((i) => [i.discenteId, ...(i.orientadorId ? [i.orientadorId] : [])])),
    ];
    const [editais, usuarios] = await Promise.all([
      Promise.all(editalIds.map((id) => this.editais.findById(id))),
      this.usuarios.findManyByIds(userIds),
    ]);
    const editalById = new Map(editais.flatMap((e) => (e ? [[e.id, e] as const] : [])));
    const userById = new Map(usuarios.map((u) => [u.id, u] as const));

    return inscricoes.map((inscricao) => ({
      inscricao,
      edital: editalById.get(inscricao.editalId),
      discente: userById.get(inscricao.discenteId),
      orientador: inscricao.orientadorId ? userById.get(inscricao.orientadorId) : undefined,
    }));
  }

  async view(inscricao: Inscricao): Promise<InscricaoView> {
    const [view] = await this.views([inscricao]);
    return view as InscricaoView;
  }

  async canView(inscricao: Inscricao, actor: AuthenticatedUser): Promise<boolean> {
    if (isGestorRole(actor.role)) return true;
    if (inscricao.discenteId === actor.id) return true;
    if (inscricao.orientadorId === actor.id && inscricao.submetidaEm) return true;
    if (actor.role === 'AVALIADOR') {
      return this.avaliadorAccess.isAvaliadorDe(inscricao.id, actor.id);
    }
    return false;
  }

  // ── Rascunho (S3.1 / S3.5) ───────────────────────────────────────────────

  async criarRascunho(discenteId: string, editalId: string): Promise<Inscricao> {
    const edital = await this.getEdital(editalId);
    assertEditalAceitaInscricoes(edital, this.clock);

    const existente = await this.inscricoes.findByEditalAndDiscente(editalId, discenteId);
    if (existente) {
      throw new ConflictError('Você já tem uma inscrição neste edital.', {
        inscricaoId: existente.id,
      });
    }

    const now = this.clock.now();
    return this.inscricoes.create({
      id: randomUUID(),
      protocolo: null,
      editalId,
      discenteId,
      orientadorId: null,
      titulo: '',
      subareaCode: '',
      subareaNome: '',
      palavrasChave: '',
      resumo: '',
      objetivos: '',
      metodologia: '',
      status: 'RASCUNHO',
      vinculoStatus: null,
      vinculoComentario: null,
      anexos: [],
      homologacaoJustificativa: null,
      submetidaEm: null,
      homologadaEm: null,
      criadoEm: now,
      atualizadoEm: now,
    });
  }

  /** Auto-save: aplica apenas os campos enviados (PATCH parcial). */
  async atualizarRascunho(id: string, actorId: string, input: RascunhoInput): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, actorId);
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

    if (input.orientadorId) {
      const orientador = await this.usuarios.findById(input.orientadorId);
      if (!orientador || orientador.role !== 'DOCENTE') {
        throw new ValidationError('O orientador indicado precisa ser um docente cadastrado.');
      }
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
      orientadorId: input.orientadorId !== undefined ? input.orientadorId : inscricao.orientadorId,
      atualizadoEm: this.clock.now(),
    });
  }

  // ── Anexos (S3.2) ────────────────────────────────────────────────────────

  async anexar(
    id: string,
    actorId: string,
    tipo: AnexoTipo,
    nomeOriginal: string,
    content: Buffer,
  ): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, actorId);
    assertEditavel(inscricao);

    const nome = sanitizeNomeArquivo(nomeOriginal);
    assertPdfValido(content, nome);

    const storageKey = randomUUID();
    await this.storage.save(storageKey, content);

    // Um anexo por tipo: o novo substitui o anterior.
    const anterior = inscricao.anexos.find((a) => a.tipo === tipo);
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
            tamanho: content.length,
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

  async removerAnexo(id: string, actorId: string, anexoId: string): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, actorId);
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
  ): Promise<{ nome: string; content: Buffer }> {
    const inscricao = await this.getForActor(id, actor);
    const anexo = inscricao.anexos.find((a) => a.id === anexoId);
    if (!anexo) {
      throw new NotFoundError('Anexo não encontrado.');
    }
    return { nome: anexo.nome, content: await this.storage.read(anexo.storageKey) };
  }

  // ── Submissão (S3.3) e vínculo com o orientador ─────────────────────────

  async submeter(id: string, actorId: string): Promise<Inscricao> {
    const inscricao = await this.getOwned(id, actorId);
    assertEditavel(inscricao);
    const edital = await this.getEdital(inscricao.editalId);
    assertEditalAceitaInscricoes(edital, this.clock);

    const pendencias = pendenciasParaSubmissao(inscricao, edital);
    if (pendencias.length > 0) {
      throw new UnprocessableEntityError('A inscrição ainda tem pendências.', { pendencias });
    }
    assertInscricaoTransition(inscricao.status, 'SUBMETIDA');

    const now = this.clock.now();
    const protocolo =
      inscricao.protocolo ??
      gerarProtocolo(await this.inscricoes.proximoSequencialProtocolo(now.getUTCFullYear()), now.getUTCFullYear());

    const saved = await this.inscricoes.update({
      ...inscricao,
      protocolo,
      status: 'SUBMETIDA',
      vinculoStatus: 'PENDENTE',
      vinculoComentario: null,
      submetidaEm: now,
      atualizadoEm: now,
    });

    const discente = await this.usuarios.findById(actorId);
    await this.notifier.notify([saved.orientadorId as string], {
      tipo: 'VINCULO_SOLICITADO',
      titulo: 'Novo pedido de orientação',
      mensagem: `${discente?.nome ?? 'Um discente'} indicou você como orientador(a) do projeto "${saved.titulo}" (protocolo ${protocolo}). Confirme ou recuse o vínculo.`,
      referenceId: saved.id,
    });
    return saved;
  }

  async responderVinculo(
    id: string,
    orientadorId: string,
    decisao: 'CONFIRMAR' | 'RECUSAR',
    comentario?: string,
  ): Promise<Inscricao> {
    const inscricao = await this.getById(id);
    if (inscricao.orientadorId !== orientadorId) {
      throw new ForbiddenError('Apenas o orientador indicado pode responder a este vínculo.');
    }
    if (inscricao.status !== 'SUBMETIDA' || inscricao.vinculoStatus !== 'PENDENTE') {
      throw new UnprocessableEntityError('Este vínculo já foi respondido.', {
        status: inscricao.status,
        vinculoStatus: inscricao.vinculoStatus,
      });
    }

    const now = this.clock.now();
    let saved: Inscricao;
    if (decisao === 'CONFIRMAR') {
      saved = await this.inscricoes.update({
        ...inscricao,
        vinculoStatus: 'CONFIRMADO',
        vinculoComentario: comentario?.trim() || null,
        atualizadoEm: now,
      });
    } else {
      if (!comentario?.trim()) {
        throw new ValidationError('Explique ao discente o motivo da recusa.');
      }
      assertInscricaoTransition(inscricao.status, 'RASCUNHO');
      // Volta ao rascunho para o discente indicar outro orientador.
      saved = await this.inscricoes.update({
        ...inscricao,
        status: 'RASCUNHO',
        vinculoStatus: 'RECUSADO',
        vinculoComentario: comentario.trim(),
        atualizadoEm: now,
      });
    }

    await this.notifier.notify([saved.discenteId], {
      tipo: 'VINCULO_RESPONDIDO',
      titulo: decisao === 'CONFIRMAR' ? 'Orientação confirmada' : 'Orientação recusada',
      mensagem:
        decisao === 'CONFIRMAR'
          ? `Seu orientador confirmou o vínculo com o projeto "${saved.titulo}". A proposta segue para a triagem.`
          : `Seu orientador recusou o vínculo com o projeto "${saved.titulo}": ${saved.vinculoComentario}. A inscrição voltou para rascunho; indique outro orientador e submeta novamente.`,
      referenceId: saved.id,
    });
    return saved;
  }

  private async getOwned(id: string, actorId: string): Promise<Inscricao> {
    const inscricao = await this.getById(id);
    if (inscricao.discenteId !== actorId) {
      throw new NotFoundError(`Inscrição ${id} não encontrada.`);
    }
    return inscricao;
  }
}

