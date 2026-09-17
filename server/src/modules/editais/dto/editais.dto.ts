import { z } from 'zod';

import { isKnownCnpqAreaCode } from '@shared/domain/cnpq-areas';
import type { Edital } from '../domain/editais.types';

/** Cota por subárea CNPq — código deve existir na tabela de áreas do conhecimento. */
export const createCotaSchema = z
  .object({
    subareaCode: z
      .string()
      .trim()
      .min(1, 'subareaCode é obrigatório')
      .refine((code) => isKnownCnpqAreaCode(code), {
        message: 'subareaCode deve ser um código válido da Tabela CNPq (ex.: "1.03").',
      }),
    quantidade: z
      .number()
      .int('quantidade deve ser um inteiro')
      .min(1, 'quantidade deve ser ≥ 1'),
  })
  .strict();

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Data ISO inválida.' });

export const createEditalSchema = z
  .object({
    numero: z.string().trim().min(3, 'numero deve ter ao menos 3 caracteres'),
    titulo: z.string().trim().min(5, 'titulo deve ter ao menos 5 caracteres'),
    descricao: z.string().trim().optional(),
    tipoBolsa: z.enum(['PIBIC', 'PIBITI', 'PIBIC_AF', 'VOLUNTARIO']),
    totalCotas: z.number().int().min(1),
    cotas: z.array(createCotaSchema).min(1, 'Informe ao menos uma cota por subárea'),
    dataInicioInscricoes: isoDate,
    dataFimInscricoes: isoDate,
  })
  .strict()
  .refine((data) => Date.parse(data.dataFimInscricoes) > Date.parse(data.dataInicioInscricoes), {
    message: 'dataFimInscricoes deve ser posterior a dataInicioInscricoes.',
    path: ['dataFimInscricoes'],
  });

/** Na edição, todos os campos são opcionais. */
export const updateEditalSchema = z
  .object({
    numero: z.string().trim().min(3).optional(),
    titulo: z.string().trim().min(5).optional(),
    descricao: z.string().trim().optional(),
    tipoBolsa: z.enum(['PIBIC', 'PIBITI', 'PIBIC_AF', 'VOLUNTARIO']).optional(),
    totalCotas: z.number().int().min(1).optional(),
    cotas: z.array(createCotaSchema).min(1).optional(),
    dataInicioInscricoes: isoDate.optional(),
    dataFimInscricoes: isoDate.optional(),
  })
  .strict();

export const transitionSchema = z
  .object({
    acao: z.enum(['publicar', 'encerrar']),
  })
  .strict();

export type CreateEditalDto = z.infer<typeof createEditalSchema>;
export type UpdateEditalDto = z.infer<typeof updateEditalSchema>;
export type TransitionDto = z.infer<typeof transitionSchema>;

/** Serializa datas para ISO — contrato estável para o cliente e os testes E2E. */
export function toEditalResponse(edital: Edital) {
  return {
    id: edital.id,
    numero: edital.numero,
    titulo: edital.titulo,
    descricao: edital.descricao ?? '',
    status: edital.status,
    tipoBolsa: edital.tipoBolsa,
    totalCotas: edital.totalCotas,
    cotas: edital.cotas.map((cota) => ({ ...cota })),
    dataInicioInscricoes: edital.dataInicioInscricoes.toISOString(),
    dataFimInscricoes: edital.dataFimInscricoes.toISOString(),
    publicadoEm: edital.publicadoEm ? edital.publicadoEm.toISOString() : null,
    encerradoEm: edital.encerradoEm ? edital.encerradoEm.toISOString() : null,
    criadoEm: edital.criadoEm.toISOString(),
    atualizadoEm: edital.atualizadoEm.toISOString(),
  };
}

/** Campos expostos publicamente (vitrine / lista de editais abertos — RF08). */
export function toPublicEditalResponse(edital: Edital) {
  const full = toEditalResponse(edital);
  return {
    id: full.id,
    numero: full.numero,
    titulo: full.titulo,
    descricao: full.descricao,
    status: full.status,
    tipoBolsa: full.tipoBolsa,
    totalCotas: full.totalCotas,
    cotas: full.cotas,
    dataInicioInscricoes: full.dataInicioInscricoes,
    dataFimInscricoes: full.dataFimInscricoes,
  };
}
