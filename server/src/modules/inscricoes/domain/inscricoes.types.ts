import type { ArquivoRef } from '@shared/storage/arquivo.storage';

/**
 * Ciclo de vida da inscrição (Arquitetura.md §5):
 * RASCUNHO → SUBMETIDA → EM_AVALIACAO → AVALIADA → APROVADA | RECUSADA
 */
export type InscricaoStatus =
  | 'RASCUNHO'
  | 'SUBMETIDA'
  | 'EM_AVALIACAO'
  | 'AVALIADA'
  | 'APROVADA'
  | 'RECUSADA';

/** Aceite do orientador indicado pelo discente (S3 — vínculo discente/orientador). */
export type VinculoStatus = 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO';

/** RF10 — documentos obrigatórios da inscrição. */
export type AnexoTipo = 'PLANO_TRABALHO' | 'LATTES';

export const ANEXO_TIPOS: readonly AnexoTipo[] = ['PLANO_TRABALHO', 'LATTES'];

export const ANEXO_LABEL: Record<AnexoTipo, string> = {
  PLANO_TRABALHO: 'Plano de trabalho',
  LATTES: 'Currículo Lattes',
};

export interface Anexo extends ArquivoRef {
  id: string;
  tipo: AnexoTipo;
  enviadoEm: Date;
}

export interface Inscricao {
  id: string;
  /** Gerado no backend na primeira submissão (formato 23076.000001/2026-NN). */
  protocolo: string | null;
  editalId: string;
  discenteId: string;
  orientadorId: string | null;
  titulo: string;
  subareaCode: string;
  subareaNome: string;
  palavrasChave: string;
  resumo: string;
  objetivos: string;
  metodologia: string;
  status: InscricaoStatus;
  vinculoStatus: VinculoStatus | null;
  vinculoComentario: string | null;
  anexos: Anexo[];
  /** Decisão final do gestor (homologação). */
  homologacaoJustificativa: string | null;
  submetidaEm: Date | null;
  homologadaEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

/** Campos editáveis pelo discente enquanto a inscrição está em rascunho. */
export interface RascunhoInput {
  titulo?: string;
  subareaCode?: string;
  palavrasChave?: string;
  resumo?: string;
  objetivos?: string;
  metodologia?: string;
  orientadorId?: string | null;
}

export interface InscricaoFiltro {
  editalId?: string;
  discenteId?: string;
  orientadorId?: string;
  status?: readonly InscricaoStatus[];
  subareaCode?: string;
}
