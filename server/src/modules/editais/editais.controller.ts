import type { Router, Request, Response, NextFunction } from 'express';

import { asyncHandler, parseBody } from '@shared/http/http.middleware';
import { requireGestor } from '@shared/auth/auth.middleware';

import type { AuditoriaService } from '../auditoria/auditoria.service';

import { EditaisService } from './editais.service';
import {
  createEditalSchema,
  transitionSchema,
  updateEditalSchema,
  toEditalResponse,
} from './dto/editais.dto';

/**
 * Rotas administrativas de editais — protegidas por autenticação + RBAC (perfil GESTOR).
 *
 * POST   /api/editais           → cria (RASCUNHO)
 * GET    /api/editais           → lista (?status=RASCUNHO|PUBLICADO|ENCERRADO)
 * GET    /api/editais/:id       → detalhe
 * PATCH  /api/editais/:id       → edita (somente RASCUNHO)
 * POST   /api/editais/:id/transicoes → { acao: "publicar" | "encerrar" }
 */
export function registerEditaisRoutes(
  router: Router,
  service: EditaisService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
  auditoria: AuditoriaService,
): void {
  const admin = [authenticationGuard, requireGestor];

  router.post(
    '/api/editais',
    ...admin,
    asyncHandler(async (req, res) => {
      const dto = parseBody(createEditalSchema, req.body);
      const edital = await service.create(dto, req.user!.id);
      await auditoria.registrar(req.user!, 'EDITAL_CRIADO', 'EDITAL', edital.id, { numero: edital.numero });
      res.status(201).json(toEditalResponse(edital));
    }),
  );

  router.get(
    '/api/editais',
    ...admin,
    asyncHandler(async (req, res) => {
      const status = req.query['status'];
      const filtro =
        typeof status === 'string' && ['RASCUNHO', 'PUBLICADO', 'ENCERRADO'].includes(status)
          ? (status as 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO')
          : undefined;
      const editais = await service.list(filtro);
      res.json({ data: editais.map(toEditalResponse), total: editais.length });
    }),
  );

  router.get(
    '/api/editais/:id',
    ...admin,
    asyncHandler(async (req, res) => {
      const edital = await service.getById(req.params['id'] as string);
      res.json(toEditalResponse(edital));
    }),
  );

  router.patch(
    '/api/editais/:id',
    ...admin,
    asyncHandler(async (req, res) => {
      const dto = parseBody(updateEditalSchema, req.body);
      const edital = await service.update(req.params['id'] as string, dto, req.user!.id);
      await auditoria.registrar(req.user!, 'EDITAL_EDITADO', 'EDITAL', edital.id, {
        numero: edital.numero,
        campos: Object.keys(dto),
      });
      res.json(toEditalResponse(edital));
    }),
  );

  router.post(
    '/api/editais/:id/transicoes',
    ...admin,
    asyncHandler(async (req, res) => {
      const dto = parseBody(transitionSchema, req.body);
      const edital = await service.transition(req.params['id'] as string, dto.acao, req.user!.id);
      const acao = dto.acao === 'publicar' ? 'EDITAL_PUBLICADO' : 'EDITAL_ENCERRADO';
      await auditoria.registrar(req.user!, acao, 'EDITAL', edital.id, { numero: edital.numero });
      res.json(toEditalResponse(edital));
    }),
  );

  // Alias RESTful para o mesmo endpoint (usado pelo frontend da SPA).
  router.post(
    '/api/editais/:id/publicar',
    ...admin,
    asyncHandler(async (req, res) => {
      const edital = await service.transition(req.params['id'] as string, 'publicar', req.user!.id);
      await auditoria.registrar(req.user!, 'EDITAL_PUBLICADO', 'EDITAL', edital.id, { numero: edital.numero });
      res.json(toEditalResponse(edital));
    }),
  );
}
