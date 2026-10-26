import { z } from 'zod';

import type { Usuario } from '../../auth/domain/auth.types';
import type { Anexo } from '../domain/inscricoes.types';
import type { CandidaturaView, InscricaoView } from '../inscricoes.service';

export const criarInscricaoSchema = z
  .object({
    editalId: z.string().trim().min(1, 'editalId é obrigatório'),
  })
  .strict();

/** Auto-save: todos os campos opcionais; limites evitam payloads abusivos. */
export const rascunhoSchema = z
  .object({
    titulo: z.string().max(200).optional(),
    subareaCode: z.string().trim().max(10).optional(),
    palavrasChave: z.string().max(200).optional(),
    resumo: z.string().max(3000).optional(),
    objetivos: z.string().max(3000).optional(),
    metodologia: z.string().max(5000).optional(),
  })
  .strict();

export const anexoTipoSchema = z.enum(['PLANO_TRABALHO', 'LATTES']);

export const candidaturaSchema = z
  .object({
    mensagem: z.string().trim().max(2000),
  })
  .strict();

export const selecaoSchema = z
  .object({
    candidaturaId: z.string().trim().min(1, 'candidaturaId é obrigatório'),
  })
  .strict();

export const submissaoSchema = z
  .object({
    avaliadorIds: z.array(z.string().trim().min(1)).max(10),
  })
  .strict();

function toPessoa(usuario: Usuario | undefined) {
  return usuario
    ? { id: usuario.id, nome: usuario.nome, email: usuario.email, departamento: usuario.departamento }
    : null;
}

export function toAnexoResponse(anexo: Anexo) {
  return {
    id: anexo.id,
    tipo: anexo.tipo,
    nome: anexo.nome,
    tamanho: anexo.tamanho,
    enviadoEm: anexo.enviadoEm.toISOString(),
  };
}

function toEditalResumo(view: InscricaoView) {
  const { edital } = view;
  return edital
    ? {
        id: edital.id,
        numero: edital.numero,
        titulo: edital.titulo,
        tipoBolsa: edital.tipoBolsa,
        dataFimInscricoes: edital.dataFimInscricoes.toISOString(),
        notaCorte: edital.notaCorte,
      }
    : null;
}

/** Contrato do projeto de pesquisa para a SPA. `pendencias` só é enviado ao professor dono. */
export function toInscricaoResponse(view: InscricaoView, extras: { pendencias?: string[] } = {}) {
  const { inscricao } = view;
  return {
    id: inscricao.id,
    protocolo: inscricao.protocolo,
    status: inscricao.status,
    titulo: inscricao.titulo,
    subareaCode: inscricao.subareaCode,
    subareaNome: inscricao.subareaNome,
    palavrasChave: inscricao.palavrasChave,
    resumo: inscricao.resumo,
    objetivos: inscricao.objetivos,
    metodologia: inscricao.metodologia,
    edital: toEditalResumo(view),
    discente: toPessoa(view.discente),
    orientador: toPessoa(view.orientador),
    anexos: inscricao.anexos.map(toAnexoResponse),
    homologacaoJustificativa: inscricao.homologacaoJustificativa,
    divulgadaEm: inscricao.divulgadaEm?.toISOString() ?? null,
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
    homologadaEm: inscricao.homologadaEm?.toISOString() ?? null,
    criadoEm: inscricao.criadoEm.toISOString(),
    atualizadoEm: inscricao.atualizadoEm.toISOString(),
    ...(extras.pendencias ? { pendencias: extras.pendencias } : {}),
  };
}

export type InscricaoResponse = ReturnType<typeof toInscricaoResponse>;

/**
 * Projeto divulgado, visto pelo aluno ou por visitantes: só os campos de
 * apresentação (sem anexos, e-mail ou dados do aluno selecionado).
 */
export function toProjetoDivulgadoResponse(view: InscricaoView, extras: { candidatos?: number } = {}) {
  const { inscricao, orientador } = view;
  return {
    id: inscricao.id,
    titulo: inscricao.titulo,
    resumo: inscricao.resumo,
    objetivos: inscricao.objetivos,
    metodologia: inscricao.metodologia,
    palavrasChave: inscricao.palavrasChave,
    subareaCode: inscricao.subareaCode,
    subareaNome: inscricao.subareaNome,
    edital: toEditalResumo(view),
    orientador: orientador ? { nome: orientador.nome, departamento: orientador.departamento } : null,
    divulgadaEm: inscricao.divulgadaEm?.toISOString() ?? null,
    ...(extras.candidatos !== undefined ? { candidatos: extras.candidatos } : {}),
  };
}

/** Candidatura vista pelo professor (com o aluno) ou pelo aluno (com o projeto). */
export function toCandidaturaResponse(view: CandidaturaView) {
  const { candidatura, discente, projeto } = view;
  return {
    id: candidatura.id,
    inscricaoId: candidatura.inscricaoId,
    status: candidatura.status,
    mensagem: candidatura.mensagem,
    criadoEm: candidatura.criadoEm.toISOString(),
    respondidaEm: candidatura.respondidaEm?.toISOString() ?? null,
    discente: discente
      ? {
          id: discente.id,
          nome: discente.nome,
          email: discente.email,
          departamento: discente.departamento,
          // O professor abre o Lattes por link temporário; aqui só indica se existe.
          temCurriculo: Boolean(discente.curriculo),
          matricula: discente.matricula,
        }
      : null,
    ...(projeto ? { projeto: { ...toProjetoDivulgadoResponse(projeto), status: projeto.inscricao.status } } : {}),
  };
}
