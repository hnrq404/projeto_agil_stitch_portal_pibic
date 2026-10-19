import type { ArquivoRef } from '@shared/storage/arquivo.storage';

/**
 * Projeto de pesquisa do professor, do rascunho à bolsa (fluxo UNICAP):
 *
 *   RASCUNHO → DIVULGADA → EM_AVALIACAO → AVALIADA → APROVADA | RECUSADA
 *
 * - RASCUNHO: o professor escreve o projeto dentro de um edital aberto.
 * - DIVULGADA: alunos veem o projeto e se candidatam; o professor seleciona um.
 * - EM_AVALIACAO: o professor enviou ao edital com o aluno e três avaliadores.
 * - AVALIADA: os três pareceres chegaram; aguarda a homologação da gestão.
 */
export type InscricaoStatus =
  | 'RASCUNHO'
  | 'DIVULGADA'
  | 'EM_AVALIACAO'
  | 'AVALIADA'
  | 'APROVADA'
  | 'RECUSADA';

/** RF10 — documentos obrigatórios no envio ao edital. */
export type AnexoTipo = 'PLANO_TRABALHO' | 'LATTES';

export const ANEXO_TIPOS: readonly AnexoTipo[] = ['PLANO_TRABALHO', 'LATTES'];

export const ANEXO_LABEL: Record<AnexoTipo, string> = {
  PLANO_TRABALHO: 'Plano de trabalho',
  LATTES: 'Currículo Lattes do aluno',
};

export interface Anexo extends ArquivoRef {
  id: string;
  tipo: AnexoTipo;
  enviadoEm: Date;
}

export interface Inscricao {
  id: string;
  /** Gerado no envio ao edital (formato 23076.000001/2026-NN). */
  protocolo: string | null;
  editalId: string;
  /** Aluno selecionado pelo professor; nulo até a seleção. */
  discenteId: string | null;
  /** Professor dono do projeto (orientador). */
  orientadorId: string;
  titulo: string;
  subareaCode: string;
  subareaNome: string;
  palavrasChave: string;
  resumo: string;
  objetivos: string;
  metodologia: string;
  status: InscricaoStatus;
  anexos: Anexo[];
  /** Decisão final do gestor (homologação). */
  homologacaoJustificativa: string | null;
  divulgadaEm: Date | null;
  submetidaEm: Date | null;
  homologadaEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

/** Campos editáveis pelo professor até o envio ao edital. */
export interface RascunhoInput {
  titulo?: string;
  subareaCode?: string;
  palavrasChave?: string;
  resumo?: string;
  objetivos?: string;
  metodologia?: string;
}

export interface InscricaoFiltro {
  editalId?: string;
  discenteId?: string;
  orientadorId?: string;
  status?: readonly InscricaoStatus[];
  subareaCode?: string;
}

// ── Candidatura do aluno ao projeto ─────────────────────────────────────────

export type CandidaturaStatus = 'PENDENTE' | 'SELECIONADA' | 'NAO_SELECIONADA';

export interface Candidatura {
  id: string;
  inscricaoId: string;
  discenteId: string;
  mensagem: string;
  status: CandidaturaStatus;
  criadoEm: Date;
  respondidaEm: Date | null;
}

export interface CandidaturaFiltro {
  inscricaoId?: string;
  discenteId?: string;
  status?: CandidaturaStatus;
}
