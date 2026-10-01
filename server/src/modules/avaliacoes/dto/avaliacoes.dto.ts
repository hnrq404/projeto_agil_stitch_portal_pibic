import { z } from 'zod';

import type { Usuario } from '../../auth/domain/auth.types';
import { CRITERIOS, type Avaliacao } from '../domain/avaliacoes.types';

const criterioIds = CRITERIOS.map((c) => c.id) as [
  (typeof CRITERIOS)[number]['id'],
  ...(typeof CRITERIOS)[number]['id'][],
];

export const atribuirSchema = z
  .object({
    avaliadorIds: z.array(z.string().trim().min(1)).min(1, 'Selecione ao menos um avaliador').max(3),
  })
  .strict();

export const parecerSchema = z
  .object({
    notas: z
      .array(
        z
          .object({
            criterio: z.enum(criterioIds),
            nota: z.number().int('notas são inteiras').min(0).max(10),
          })
          .strict(),
      )
      .length(CRITERIOS.length, `Avalie os ${CRITERIOS.length} critérios da rubrica`),
    parecer: z.string().max(5000),
  })
  .strict();

export const homologacaoSchema = z
  .object({
    decisao: z.enum(['APROVAR', 'RECUSAR']),
    justificativa: z.string().trim().max(2000).default(''),
  })
  .strict();

export function toAvaliacaoResponse(avaliacao: Avaliacao, avaliador?: Usuario) {
  return {
    id: avaliacao.id,
    inscricaoId: avaliacao.inscricaoId,
    avaliador: avaliador
      ? { id: avaliador.id, nome: avaliador.nome, departamento: avaliador.departamento }
      : { id: avaliacao.avaliadorId, nome: 'Avaliador removido', departamento: '' },
    status: avaliacao.status,
    notas: avaliacao.notas,
    notaFinal: avaliacao.notaFinal,
    parecer: avaliacao.parecer,
    atribuidaEm: avaliacao.atribuidaEm.toISOString(),
    concluidaEm: avaliacao.concluidaEm?.toISOString() ?? null,
  };
}
