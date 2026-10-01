export type AvaliacaoStatus = 'PENDENTE' | 'CONCLUIDA';

/** Rubrica fixa da v1 — cada critério recebe nota inteira de 0 a 10 (RF15). */
export const CRITERIOS = [
  {
    id: 'MERITO',
    nome: 'Mérito científico',
    descricao: 'Relevância do problema, originalidade e fundamentação teórica.',
  },
  {
    id: 'VIABILIDADE',
    nome: 'Viabilidade do plano de trabalho',
    descricao: 'Cronograma, recursos e metodologia compatíveis com 12 meses de bolsa.',
  },
  {
    id: 'ADEQUACAO',
    nome: 'Adequação ao edital',
    descricao: 'Aderência à subárea CNPq e às regras do programa.',
  },
  {
    id: 'FORMACAO',
    nome: 'Potencial de formação',
    descricao: 'Contribuição do projeto para a formação científica do discente.',
  },
] as const;

export type CriterioId = (typeof CRITERIOS)[number]['id'];

export interface NotaCriterio {
  criterio: CriterioId;
  nota: number;
}

export interface Avaliacao {
  id: string;
  inscricaoId: string;
  avaliadorId: string;
  status: AvaliacaoStatus;
  notas: NotaCriterio[];
  /** Média dos critérios (2 casas). Nula enquanto pendente. */
  notaFinal: number | null;
  parecer: string;
  atribuidaEm: Date;
  concluidaEm: Date | null;
}

export interface AvaliacaoFiltro {
  inscricaoId?: string;
  inscricaoIds?: readonly string[];
  avaliadorId?: string;
  status?: AvaliacaoStatus;
}

/** Consolidação dos pareceres de uma inscrição (RF17 / RN08). */
export interface Consolidado {
  total: number;
  concluidas: number;
  media: number | null;
  menor: number | null;
  maior: number | null;
  /** Diferença entre a maior e a menor nota acima do limiar (RN08). */
  divergente: boolean;
}
