import { z } from 'zod';

/** Mínimos espelhados de inscricoes.rules (backend), para validar cada etapa antes de avançar. */
export const MIN_TITULO = 10;
export const MIN_RESUMO = 100;
export const MIN_TEXTO = 50;

export const ETAPAS = ['Projeto', 'Proposta', 'Orientador', 'Documentos', 'Revisão'] as const;

export const rascunhoSchema = z.object({
  titulo: z.string().trim().min(MIN_TITULO, `Use ao menos ${MIN_TITULO} caracteres.`).max(200),
  subareaCode: z.string().min(1, 'Selecione a subárea CNPq.'),
  palavrasChave: z.string().max(200),
  resumo: z.string().trim().min(MIN_RESUMO, `O resumo precisa de ao menos ${MIN_RESUMO} caracteres.`).max(3000),
  objetivos: z.string().trim().min(MIN_TEXTO, `Descreva com ao menos ${MIN_TEXTO} caracteres.`).max(3000),
  metodologia: z.string().trim().min(MIN_TEXTO, `Descreva com ao menos ${MIN_TEXTO} caracteres.`).max(5000),
  orientadorId: z.string().min(1, 'Indique o orientador.'),
});

export type RascunhoForm = z.infer<typeof rascunhoSchema>;

/** Campos validados ao tentar avançar de cada etapa. */
export const CAMPOS_DA_ETAPA: Record<number, (keyof RascunhoForm)[]> = {
  0: ['titulo', 'subareaCode', 'palavrasChave'],
  1: ['resumo', 'objetivos', 'metodologia'],
  2: ['orientadorId'],
  3: [],
  4: [],
};
