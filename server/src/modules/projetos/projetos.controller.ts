import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

import { createRoleGuard, requireGestor } from '@shared/auth/auth.middleware';
import {
  asyncHandler,
  parseBody,
  pdfBodyParser,
  readUploadBody,
  readUploadFilename,
  sendPdf,
} from '@shared/http/http.middleware';
import { ValidationError } from '@shared/errors/domain.errors';

import { toInscricaoResponse } from '../inscricoes/dto/inscricoes.dto';
import type { InscricoesService } from '../inscricoes/inscricoes.service';

import type { Relatorio } from './domain/projetos.types';
import type { ProjetosService } from './projetos.service';

const requireDiscente = createRoleGuard(['DISCENTE']);
const requireDocente = createRoleGuard(['DOCENTE']);

const tipoSchema = z.enum(['PARCIAL', 'FINAL']);
const avaliacaoRelatorioSchema = z
  .object({
    decisao: z.enum(['APROVAR', 'DEVOLVER']),
    comentario: z.string().trim().max(2000).default(''),
  })
  .strict();

function toRelatorioResponse(r: Relatorio) {
  return {
    id: r.id,
    tipo: r.tipo,
    versao: r.versao,
    status: r.status,
    nome: r.nome,
    tamanho: r.tamanho,
    comentarioOrientador: r.comentarioOrientador,
    enviadoEm: r.enviadoEm.toISOString(),
    avaliadoEm: r.avaliadoEm?.toISOString() ?? null,
  };
}

/**
 * Rotas de projetos (inscrições aprovadas) e relatórios — RF19 a RF22:
 *   GET  /api/projetos                                   → meus projetos (por papel)
 *   GET  /api/projetos/exportacao.csv?editalId=          → CSV (GESTOR)
 *   GET  /api/projetos/:id                               → detalhe + relatórios + timeline
 *   PUT  /api/projetos/:id/relatorios/:tipo              → envia PDF (DISCENTE)
 *   GET  /api/projetos/:id/relatorios/:relatorioId/arquivo
 *   POST /api/projetos/:id/relatorios/:relatorioId/avaliacao → aprova/devolve (DOCENTE)
 */
export function registerProjetosRoutes(
  router: Router,
  service: ProjetosService,
  inscricoesService: InscricoesService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.get(
    '/api/projetos',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const projetos = await service.listForActor(req.user!);
      const views = await inscricoesService.views(projetos);
      res.json({ data: views.map((v) => toInscricaoResponse(v)), total: views.length });
    }),
  );

  router.get(
    '/api/projetos/exportacao.csv',
    authenticationGuard,
    requireGestor,
    asyncHandler(async (req, res) => {
      const editalId = typeof req.query['editalId'] === 'string' ? req.query['editalId'] : undefined;
      const csv = await service.exportarCsv(editalId || undefined);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="projetos-pibic.csv"');
      res.send(csv);
    }),
  );

  router.get(
    '/api/projetos/:id',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const detalhe = await service.detalhe(req.params['id'] as string, req.user!);
      res.json({
        projeto: toInscricaoResponse(await inscricoesService.view(detalhe.inscricao)),
        relatorios: detalhe.relatorios.map(toRelatorioResponse),
        acompanhamento: detalhe.acompanhamento.map((a) => ({ ...a, prazo: a.prazo.toISOString() })),
        timeline: detalhe.timeline.map((e) => ({ ...e, data: e.data.toISOString() })),
      });
    }),
  );

  router.put(
    '/api/projetos/:id/relatorios/:tipo',
    authenticationGuard,
    requireDiscente,
    pdfBodyParser,
    asyncHandler(async (req, res) => {
      const tipo = tipoSchema.safeParse(req.params['tipo']);
      if (!tipo.success) {
        throw new ValidationError('Tipo de relatório inválido. Use PARCIAL ou FINAL.');
      }
      const relatorio = await service.enviarRelatorio(
        req.params['id'] as string,
        req.user!.id,
        tipo.data,
        readUploadFilename(req),
        readUploadBody(req),
      );
      res.status(201).json(toRelatorioResponse(relatorio));
    }),
  );

  router.get(
    '/api/projetos/:id/relatorios/:relatorioId/arquivo',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const arquivo = await service.lerRelatorio(
        req.params['id'] as string,
        req.user!,
        req.params['relatorioId'] as string,
      );
      sendPdf(res, arquivo.content, arquivo.nome);
    }),
  );

  router.post(
    '/api/projetos/:id/relatorios/:relatorioId/avaliacao',
    authenticationGuard,
    requireDocente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(avaliacaoRelatorioSchema, req.body);
      const relatorio = await service.avaliarRelatorio(
        req.params['id'] as string,
        req.user!.id,
        req.params['relatorioId'] as string,
        dto.decisao,
        dto.comentario,
      );
      res.json(toRelatorioResponse(relatorio));
    }),
  );
}
