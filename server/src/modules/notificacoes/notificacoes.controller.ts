import type { Router, Request, Response, NextFunction } from 'express';

import { asyncHandler } from '@shared/http/http.middleware';

import { NotFoundError } from '@shared/errors/domain.errors';
import { NotificacoesService } from './notificacoes.service';

/**
 * Rotas de notificações in-app (usuário autenticado):
 * GET   /api/notificacoes          → lista as minhas notificações (?somenteNaoLidas=true)
 * PATCH /api/notificacoes/:id/leitura → marca uma notificação como lida
 */
export function registerNotificacoesRoutes(
  router: Router,
  service: NotificacoesService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.get(
    '/api/notificacoes',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const somenteNaoLidas = req.query['somenteNaoLidas'] === 'true';
      const data = await service.listByUser(req.user!.id, somenteNaoLidas);
      res.json({
        data: data.map((n) => ({
          id: n.id,
          tipo: n.tipo,
          titulo: n.titulo,
          mensagem: n.mensagem,
          referenceId: n.referenceId ?? null,
          lida: n.lida,
          criadoEm: n.criadoEm.toISOString(),
        })),
        total: data.length,
      });
    }),
  );

  router.patch(
    '/api/notificacoes/:id/leitura',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      try {
        const n = await service.markAsRead(req.user!.id, req.params['id'] as string);
        res.json({ id: n.id, lida: n.lida });
      } catch {
        throw new NotFoundError('Notificação não encontrada para este usuário.');
      }
    }),
  );
}
