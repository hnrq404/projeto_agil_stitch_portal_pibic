import { timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response, Router } from 'express';

import { UnauthorizedError } from '../../shared/auth/auth.types';
import { asyncHandler } from '../../shared/http/http.middleware';
import type { EditaisService } from '../../modules/editais/editais.service';
import type { ProjetosService } from '../../modules/projetos/projetos.service';

/**
 * Tarefas periódicas na Vercel (sem processo contínuo, os timers do index.ts não
 * existem lá). A Vercel Cron chama estas rotas com `Authorization: Bearer
 * <CRON_SECRET>`; sem CRON_SECRET configurado, elas ficam fechadas.
 *
 *   GET /api/cron/encerrar-editais       → encerra editais com prazo vencido
 *   GET /api/cron/lembretes-relatorio    → lembretes e avisos de atraso do relatório mensal
 */
export function registerCronRoutes(
  router: Router,
  deps: { editaisService: EditaisService; projetosService: ProjetosService },
  segredo: string | undefined = process.env['CRON_SECRET'],
): void {
  function autorizar(req: Request, _res: Response, next: NextFunction): void {
    const esperado = Buffer.from(`Bearer ${segredo ?? ''}`);
    const recebido = Buffer.from(req.headers.authorization ?? '');
    const valido = Boolean(segredo) && esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
    next(valido ? undefined : new UnauthorizedError('Rota de tarefa agendada.'));
  }

  router.get(
    '/api/cron/encerrar-editais',
    autorizar,
    asyncHandler(async (_req, res) => {
      res.json({ encerrados: await deps.editaisService.syncAutomaticClosure() });
    }),
  );

  router.get(
    '/api/cron/lembretes-relatorio',
    autorizar,
    asyncHandler(async (_req, res) => {
      res.json({ enviados: await deps.projetosService.enviarLembretes() });
    }),
  );
}
