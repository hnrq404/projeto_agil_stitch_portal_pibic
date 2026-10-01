/**
 * Regras de negócio da avaliação — Sprint 4.
 * Funções PURAS, sem dependência de framework/infra: cobertura unitária direta.
 */

import { UnprocessableEntityError, ValidationError } from '@shared/errors/domain.errors';

import {
  CRITERIOS,
  type Avaliacao,
  type Consolidado,
  type NotaCriterio,
} from './avaliacoes.types';

/** RN08 — diferença de nota entre avaliadores que exige atenção do gestor. */
export const LIMIAR_DIVERGENCIA = 3;

/** RN07 — tamanho mínimo do parecer quando ele é obrigatório. */
export const MIN_PARECER = 30;

export const MAX_AVALIADORES_POR_INSCRICAO = 3;

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Exige exatamente uma nota inteira 0–10 por critério da rubrica e devolve a média. */
export function calcularNotaFinal(notas: readonly NotaCriterio[]): number {
  const porCriterio = new Map(notas.map((n) => [n.criterio, n.nota]));
  if (porCriterio.size !== notas.length) {
    throw new ValidationError('Cada critério deve receber uma única nota.');
  }
  for (const criterio of CRITERIOS) {
    const nota = porCriterio.get(criterio.id);
    if (nota === undefined) {
      throw new ValidationError(`Atribua uma nota ao critério "${criterio.nome}".`);
    }
    if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
      throw new ValidationError(`A nota de "${criterio.nome}" deve ser um inteiro de 0 a 10.`);
    }
  }
  if (porCriterio.size !== CRITERIOS.length) {
    throw new ValidationError('Há critérios desconhecidos na rubrica.');
  }
  const soma = CRITERIOS.reduce((acc, c) => acc + (porCriterio.get(c.id) as number), 0);
  return arredondar(soma / CRITERIOS.length);
}

/** RN07 — parecer textual obrigatório quando a nota fica abaixo da nota de corte do edital. */
export function parecerObrigatorio(notaFinal: number, notaCorte: number): boolean {
  return notaFinal < notaCorte;
}

export function assertParecer(notaFinal: number, notaCorte: number, parecer: string): void {
  if (parecerObrigatorio(notaFinal, notaCorte) && parecer.trim().length < MIN_PARECER) {
    throw new ValidationError(
      `A nota ${notaFinal.toFixed(2)} está abaixo da nota de corte (${notaCorte}). ` +
        `Justifique no parecer (mínimo de ${MIN_PARECER} caracteres) (RN07).`,
    );
  }
}

/** RF17 / RN08 — média das avaliações concluídas e sinalização de divergência. */
export function consolidar(avaliacoes: readonly Avaliacao[]): Consolidado {
  const notas = avaliacoes
    .filter((a) => a.status === 'CONCLUIDA' && a.notaFinal !== null)
    .map((a) => a.notaFinal as number);
  if (notas.length === 0) {
    return {
      total: avaliacoes.length,
      concluidas: 0,
      media: null,
      menor: null,
      maior: null,
      divergente: false,
    };
  }
  const menor = Math.min(...notas);
  const maior = Math.max(...notas);
  return {
    total: avaliacoes.length,
    concluidas: notas.length,
    media: arredondar(notas.reduce((a, b) => a + b, 0) / notas.length),
    menor,
    maior,
    divergente: maior - menor > LIMIAR_DIVERGENCIA,
  };
}

export interface PessoaConflito {
  id: string;
  departamento: string;
}

/**
 * Conflito de interesse (Sprints.md, S4): o avaliador não pode ser o próprio
 * orientador nem pertencer ao mesmo departamento dele.
 */
export function motivoConflito(
  avaliador: PessoaConflito,
  orientador: PessoaConflito | undefined,
  discenteId: string,
): string | null {
  if (avaliador.id === discenteId) {
    return 'o avaliador é o próprio discente';
  }
  if (!orientador) return null;
  if (avaliador.id === orientador.id) {
    return 'o avaliador é o orientador da proposta';
  }
  if (avaliador.departamento && avaliador.departamento === orientador.departamento) {
    return `o avaliador é do mesmo departamento do orientador (${orientador.departamento})`;
  }
  return null;
}

export function assertQuantidadeAvaliadores(atuais: number, novos: number): void {
  if (atuais + novos > MAX_AVALIADORES_POR_INSCRICAO) {
    throw new UnprocessableEntityError(
      `Cada proposta aceita no máximo ${MAX_AVALIADORES_POR_INSCRICAO} avaliadores (já tem ${atuais}).`,
    );
  }
}
