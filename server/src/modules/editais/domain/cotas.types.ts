/** Cota de bolsas distribuída para uma subárea CNPq dentro de um edital. */
export interface CotaSubarea {
  /** Código da Área do Conhecimento CNPq (2º nível), ex.: "1.03" (Ciência da Computação). */
  subareaCode: string;
  /** Nome amigável resolvido da subárea (preenchido pelo backend). */
  subareaNome: string;
  /** Quantidade de bolsas reservadas para esta subárea. */
  quantidade: number;
}
