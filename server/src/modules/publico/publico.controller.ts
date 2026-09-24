import type { Router } from 'express';

import { asyncHandler } from '@shared/http/http.middleware';
import type { Clock } from '@shared/time/clock';

import { EditaisService } from '../editais/editais.service';
import { toPublicEditalResponse } from '../editais/dto/editais.dto';

/**
 * Rota pública (sem autenticação) — RF08/S2.4:
 * GET /api/publico/editais → apenas editais PUBLICADO com prazos vigentes.
 * Base para a vitrine pública (Sprint 6).
 */
export function registerPublicoRoutes(
  router: Router,
  editaisService: EditaisService,
  clock: Clock,
): void {
  router.get(
    '/api/publico/editais',
    asyncHandler(async (_req, res) => {
      await editaisService.syncAutomaticClosure();
      const publicados = await editaisService.list('PUBLICADO');
      const now = clock.now().getTime();
      const vigentes = publicados.filter(
        (edital) => edital.dataFimInscricoes.getTime() >= now,
      );
      res.json({
        data: vigentes.map(toPublicEditalResponse),
        total: vigentes.length,
        geradoEm: clock.now().toISOString(),
      });
    }),
  );
}
