import { z } from "zod";

/**
 * Schemas Zod por etapa do formulário multi-etapas (S3.1) — validação por
 * etapa antes de avançar. Espelham as regras do backend
 * (convex/inscricoes/regras.ts) para feedback imediato.
 */

export const etapaDadosSchema = z.object({
  editalId: z.string().min(1, "Selecione o edital."),
  titulo: z.string().trim().min(10, "Título deve ter ao menos 10 caracteres."),
  areaCnpq: z.string().min(2, "Selecione a grande área CNPq."),
  resumo: z.string().trim().min(50, "Resumo deve ter ao menos 50 caracteres."),
  palavrasChave: z
    .array(z.string())
    .min(3, "Informe ao menos 3 palavras-chave.")
    .refine(
      (lista) => lista.every((p) => p.trim().length > 0),
      "Palavras-chave não podem ser vazias.",
    ),
  orientadorId: z.string().min(1, "Selecione o professor orientador."),
});

export const etapaProjetoSchema = z.object({
  metodologia: z.string().trim().min(100, "Metodologia deve ter ao menos 100 caracteres."),
  cronograma: z.string().trim().min(50, "Cronograma deve ter ao menos 50 caracteres."),
});

export const etapaAnexosSchema = z.object({
  planoTrabalhoFileId: z.string().min(1, "Anexe o plano de trabalho em PDF."),
  lattesFileId: z.string().optional(),
});

export const etapaRevisaoSchema = z.object({
  declaracaoVeracidade: z.literal(true, {
    message: "Declaração de veracidade obrigatória.",
  }),
});

export const GRANDES_AREAS_CNPQ = [
  "1.00.00.00-3 — Ciências Exatas e da Terra",
  "2.00.00.00-6 — Ciências Biológicas",
  "3.00.00.00-9 — Engenharias",
  "4.00.00.00-1 — Ciências da Saúde",
  "5.00.00.00-4 — Ciências Agrárias",
  "6.00.00.00-7 — Ciências Sociais Aplicadas",
  "7.00.00.00-0 — Ciências Humanas",
  "8.00.00.00-2 — Linguística, Letras e Artes",
] as const;
