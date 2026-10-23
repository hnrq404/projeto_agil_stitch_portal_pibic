import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

import { createRoleGuard, requireGestor } from '@shared/auth/auth.middleware';
import { asyncHandler, parseBody } from '@shared/http/http.middleware';
import { confirmarEnvioSchema } from '@shared/storage/arquivo.dto';

import { toInscricaoResponse } from '../inscricoes/dto/inscricoes.dto';
import type { InscricoesService } from '../inscricoes/inscricoes.service';

import type { Relatorio } from './domain/projetos.types';
import type { ProjetosService } from './projetos.service';

const requireDiscente = createRoleGuard(['DISCENTE']);
const requireDocente = createRoleGuard(['DOCENTE']);

const novoRelatorioSchema = z
  .object({
    tipo: z.enum(['MENSAL', 'FINAL']),
    competencia: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM').optional(),
    descricao: z.string().max(10000),
  })
  .strict();

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
    competencia: r.competencia || null,
    versao: r.versao,
    status: r.status,
    descricao: r.descricao,
    arquivo: r.arquivo ? { nome: r.arquivo.nome, tamanho: r.arquivo.tamanho } : null,
    comentarioOrientador: r.comentarioOrientador,
    enviadoEm: r.enviadoEm.toISOString(),
    avaliadoEm: r.avaliadoEm?.toISOString() ?? null,
  };
}

/**
 * Rotas de projetos (inscrições aprovadas) e relatórios — RF19 a RF22:
 *   GET  /api/projetos                                       → meus projetos (por papel)
 *   GET  /api/projetos/exportacao.csv?editalId=              → CSV (GESTOR)
 *   GET  /api/projetos/:id                                   → detalhe + relatórios + acompanhamento + timeline
 *   POST /api/projetos/:id/relatorios                        → envia o texto do relatório (DISCENTE)
 *   POST /api/projetos/:id/relatorios/:relatorioId/arquivo/envio → autoriza o envio do PDF (DISCENTE, enquanto em análise)
 *   PUT  /api/projetos/:id/relatorios/:relatorioId/arquivo   → { chave, nome }: confere o PDF enviado e o anexa
 *   GET  /api/projetos/:id/relatorios/:relatorioId/arquivo   → { nome, url }: link temporário para abrir o PDF
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
        acompanhamento: detalhe.acompanhamento.map((a) => ({
          ...a,
          competencia: a.competencia || null,
          prazo: a.prazo.toISOString(),
        })),
        timeline: detalhe.timeline.map((e) => ({ ...e, data: e.data.toISOString() })),
      });
    }),
  );

  router.post(
    '/api/projetos/:id/relatorios',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(novoRelatorioSchema, req.body);
      const relatorio = await service.enviarRelatorio(req.params['id'] as string, req.user!.id, dto);
      res.status(201).json(toRelatorioResponse(relatorio));
    }),
  );

  // Envio em duas etapas: autoriza o upload direto ao armazenamento e depois confirma.
  router.post(
    '/api/projetos/:id/relatorios/:relatorioId/arquivo/envio',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      res.json(
        await service.prepararArquivo(req.params['id'] as string, req.user!.id, req.params['relatorioId'] as string),
      );
    }),
  );

  router.put(
    '/api/projetos/:id/relatorios/:relatorioId/arquivo',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(confirmarEnvioSchema, req.body);
      const relatorio = await service.anexarArquivo(
        req.params['id'] as string,
        req.user!.id,
        req.params['relatorioId'] as string,
        dto.chave,
        dto.nome,
      );
      res.json(toRelatorioResponse(relatorio));
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
      res.json(arquivo);
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
