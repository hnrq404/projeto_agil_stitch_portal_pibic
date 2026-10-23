import { z } from 'zod';

/** Confirmação de um envio feito direto ao armazenamento: a chave emitida pela API e o nome original. */
export const confirmarEnvioSchema = z
  .object({
    chave: z.string().trim().min(1).max(200),
    nome: z.string().trim().min(1, 'informe o nome do arquivo').max(255),
  })
  .strict();

export type ConfirmarEnvioDto = z.infer<typeof confirmarEnvioSchema>;
