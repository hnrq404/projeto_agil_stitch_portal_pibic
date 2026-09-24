import { Router } from 'express';

import { CNPQ_AREAS } from '../domain/cnpq-areas';

/** GET /api/cnpq/areas — tabela de áreas do conhecimento para os selects do frontend. */
export function registerCnpqRoutes(router: Router): void {
  router.get('/api/cnpq/areas', (_req, res) => {
    res.json({ data: CNPQ_AREAS, total: CNPQ_AREAS.length });
  });
}
