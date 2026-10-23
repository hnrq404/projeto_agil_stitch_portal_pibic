import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

import { requireGestor } from '@shared/auth/auth.middleware';
import { ValidationError } from '@shared/errors/domain.errors';
import { asyncHandler } from '@shared/http/http.middleware';

import type { AuditoriaService } from './auditoria.service';
import { ENTIDADES_AUDITORIA, type RegistroAuditoria } from './domain/auditoria.types';

const filtroSchema = z.object({
  entidade: z.enum(ENTIDADES_AUDITORIA).optional(),
  entidadeId: z.string().trim().min(1).max(64).optional(),
  actorId: z.string().trim().min(1).max(64).optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

function toRegistroResponse(registro: RegistroAuditoria) {
  return {
    id: registro.id,
    acao: registro.acao,
    entidade: registro.entidade,
    entidadeId: registro.entidadeId,
    actor: { id: registro.actorId, nome: registro.actorNome },
    detalhes: registro.detalhes,
    criadoEm: registro.criadoEm.toISOString(),
  };
}

/**
 * Trilha de auditoria (GESTOR):
 *   GET /api/auditoria?entidade=&entidadeId=&actorId=&limite=  → mais recentes primeiro (padrão 50, máx. 200)
 */
export function registerAuditoriaRoutes(
  router: Router,
  service: AuditoriaService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.get(
    '/api/auditoria',
    authenticationGuard,
    requireGestor,
    asyncHandler(async (req, res) => {
      const parsed = filtroSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Filtro de auditoria inválido.', parsed.error.flatten());
      }
      const { data, total } = await service.listar(parsed.data);
      res.json({ data: data.map(toRegistroResponse), total });
    }),
  );
}
