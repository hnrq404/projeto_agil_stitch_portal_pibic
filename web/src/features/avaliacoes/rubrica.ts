import type { CriterioId, NotaCriterio } from '@/shared/types/api';

/** Espelha avaliacoes.rules do backend para mostrar a média e a exigência do parecer em tempo real. */
export const MIN_PARECER = 30;
export const LIMIAR_DIVERGENCIA = 3;

export type NotasParciais = Partial<Record<CriterioId, number>>;

export function mediaParcial(notas: NotasParciais, criterios: readonly CriterioId[]): number | null {
  const valores = criterios.map((c) => notas[c]).filter((n): n is number => n !== undefined);
  if (valores.length !== criterios.length || criterios.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100;
}

/** RN07: abaixo da nota de corte, o parecer textual é obrigatório. */
export function parecerObrigatorio(media: number | null, notaCorte: number): boolean {
  return media !== null && media < notaCorte;
}

export function parecerValido(media: number | null, notaCorte: number, parecer: string): boolean {
  return !parecerObrigatorio(media, notaCorte) || parecer.trim().length >= MIN_PARECER;
}

export function toNotas(notas: NotasParciais, criterios: readonly CriterioId[]): NotaCriterio[] {
  return criterios.map((criterio) => ({ criterio, nota: notas[criterio] ?? 0 }));
}
