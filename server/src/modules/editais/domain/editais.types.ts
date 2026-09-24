import type { CotaSubarea } from './cotas.types';

/** Ciclo de vida do edital — Sprint 2: RASCUNHO → PUBLICADO → ENCERRADO */
export type EditalStatus = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO';

/** Tipo de bolsa CNPq suportado pelo portal. */
export type BolsaTipo = 'PIBIC' | 'PIBITI' | 'PIBIC_AF' | 'VOLUNTARIO';

export interface Edital {
  id: string;
  numero: string;
  titulo: string;
  descricao: string;
  status: EditalStatus;
  tipoBolsa: BolsaTipo;
  /** Quantidade TOTAL de bolsas/cotas do edital. */
  totalCotas: number;
  /** Cotas distribuídas por subárea CNPq (soma ≤ totalCotas). */
  cotas: CotaSubarea[];
  /** Início das inscrições (inclusive). */
  dataInicioInscricoes: Date;
  /** Prazo final das inscrições (inclusive até 23:59:59.999). */
  dataFimInscricoes: Date;
  publicadoEm: Date | null;
  encerradoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

/** Entrada para criação — datas chegam como string ISO do cliente. */
export interface CreateEditalInput {
  numero: string;
  titulo: string;
  descricao?: string;
  tipoBolsa: BolsaTipo;
  totalCotas: number;
  cotas: CreateCotaInput[];
  dataInicioInscricoes: string;
  dataFimInscricoes: string;
}

export interface UpdateEditalInput {
  numero?: string;
  titulo?: string;
  descricao?: string;
  tipoBolsa?: BolsaTipo;
  totalCotas?: number;
  cotas?: CreateCotaInput[];
  dataInicioInscricoes?: string;
  dataFimInscricoes?: string;
}

export interface CreateCotaInput {
  subareaCode: string;
  quantidade: number;
}
