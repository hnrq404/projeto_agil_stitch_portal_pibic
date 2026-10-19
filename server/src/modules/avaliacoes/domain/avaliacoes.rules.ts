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

/** O professor dono do projeto indica três colegas para avaliá-lo. */
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

/**
 * Conflito de interesse: o avaliador é outro professor, nunca o próprio
 * orientador nem o aluno do projeto. Colegas do mesmo departamento podem
 * avaliar (costumam ser os especialistas da área).
 */
export function motivoConflito(
  avaliadorId: string,
  orientadorId: string,
  discenteId: string | null,
): string | null {
  if (avaliadorId === orientadorId) {
    return 'o professor não pode avaliar o próprio projeto';
  }
  if (discenteId && avaliadorId === discenteId) {
    return 'o aluno do projeto não pode avaliá-lo';
  }
  return null;
}

/** No envio ao edital, o professor indica exatamente três avaliadores distintos. */
export function assertIndicacaoAvaliadores(avaliadorIds: readonly string[]): void {
  if (new Set(avaliadorIds).size !== avaliadorIds.length) {
    throw new ValidationError('Indique três professores diferentes como avaliadores.');
  }
  if (avaliadorIds.length !== MAX_AVALIADORES_POR_INSCRICAO) {
    throw new ValidationError(
      `Indique exatamente ${MAX_AVALIADORES_POR_INSCRICAO} professores para avaliar o projeto (foram ${avaliadorIds.length}).`,
    );
  }
}

export function assertQuantidadeAvaliadores(atuais: number, novos: number): void {
  if (atuais + novos > MAX_AVALIADORES_POR_INSCRICAO) {
    throw new UnprocessableEntityError(
      `Cada projeto tem no máximo ${MAX_AVALIADORES_POR_INSCRICAO} avaliadores (já tem ${atuais}).`,
    );
  }
}

/** O projeto só fica AVALIADO quando os três pareceres foram enviados. */
export function avaliacaoCompleta(avaliacoes: readonly Avaliacao[]): boolean {
  return (
    avaliacoes.length >= MAX_AVALIADORES_POR_INSCRICAO && avaliacoes.every((a) => a.status === 'CONCLUIDA')
  );
}
