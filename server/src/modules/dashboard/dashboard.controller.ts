import type { NextFunction, Request, Response, Router } from 'express';

import { requireGestor } from '@shared/auth/auth.middleware';
import { asyncHandler } from '@shared/http/http.middleware';

import type { DashboardService } from './dashboard.service';

/** GET /api/dashboard/gestor?editalId= → KPIs, cotas por subárea e alertas (GESTOR). */
export function registerDashboardRoutes(
  router: Router,
  service: DashboardService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.get(
    '/api/dashboard/gestor',
    authenticationGuard,
    requireGestor,
    asyncHandler(async (req, res) => {
      const editalId = typeof req.query['editalId'] === 'string' ? req.query['editalId'] : undefined;
      res.json(await service.painelGestor(editalId || undefined));
    }),
  );
}
