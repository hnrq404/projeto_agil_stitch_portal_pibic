import type { NextFunction, Request, Response, Router } from 'express';

import { createRoleGuard } from '@shared/auth/auth.middleware';
import {
  asyncHandler,
  parseBody,
  pdfBodyParser,
  readUploadBody,
  readUploadFilename,
  sendPdf,
} from '@shared/http/http.middleware';
import { ValidationError } from '@shared/errors/domain.errors';

import type { InscricoesService } from './inscricoes.service';
import {
  anexoTipoSchema,
  criarInscricaoSchema,
  rascunhoSchema,
  toInscricaoResponse,
  vinculoSchema,
} from './dto/inscricoes.dto';

const requireDiscente = createRoleGuard(['DISCENTE']);
const requireDocente = createRoleGuard(['DOCENTE']);

/**
 * Rotas de inscrição (S3):
 *   POST   /api/inscricoes                          → cria rascunho (DISCENTE)
 *   GET    /api/inscricoes/minhas                   → minhas inscrições (DISCENTE)
 *   GET    /api/orientacoes                         → inscrições em que fui indicado (DOCENTE)
 *   GET    /api/inscricoes/:id                      → detalhe (dono, orientador, avaliador, gestor)
 *   PATCH  /api/inscricoes/:id                      → auto-save do rascunho (DISCENTE)
 *   PUT    /api/inscricoes/:id/anexos/:tipo         → envia PDF (application/pdf, header X-Filename)
 *   DELETE /api/inscricoes/:id/anexos/:anexoId      → remove anexo do rascunho
 *   GET    /api/inscricoes/:id/anexos/:anexoId/arquivo → baixa/visualiza o PDF
 *   POST   /api/inscricoes/:id/submissao            → submete (gera protocolo)
 *   POST   /api/inscricoes/:id/vinculo              → orientador confirma/recusa
 */
export function registerInscricoesRoutes(
  router: Router,
  service: InscricoesService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.post(
    '/api/inscricoes',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(criarInscricaoSchema, req.body);
      const inscricao = await service.criarRascunho(req.user!.id, dto.editalId);
      res.status(201).json(toInscricaoResponse(await service.view(inscricao)));
    }),
  );

  router.get(
    '/api/inscricoes/minhas',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      const inscricoes = await service.list({ discenteId: req.user!.id });
      const views = await service.views(inscricoes);
      res.json({ data: views.map((v) => toInscricaoResponse(v)), total: views.length });
    }),
  );

  router.get(
    '/api/orientacoes',
    authenticationGuard,
    requireDocente,
    asyncHandler(async (req, res) => {
      const inscricoes = await service.listDoOrientador(req.user!.id);
      const views = await service.views(inscricoes);
      res.json({ data: views.map((v) => toInscricaoResponse(v)), total: views.length });
    }),
  );

  router.get(
    '/api/inscricoes/:id',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const inscricao = await service.getForActor(req.params['id'] as string, req.user!);
      const isDonoEmRascunho = inscricao.discenteId === req.user!.id && inscricao.status === 'RASCUNHO';
      const pendencias = isDonoEmRascunho ? await service.pendencias(inscricao) : undefined;
      res.json(toInscricaoResponse(await service.view(inscricao), { pendencias }));
    }),
  );

  router.patch(
    '/api/inscricoes/:id',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(rascunhoSchema, req.body);
      const inscricao = await service.atualizarRascunho(req.params['id'] as string, req.user!.id, dto);
      res.json(
        toInscricaoResponse(await service.view(inscricao), {
          pendencias: await service.pendencias(inscricao),
        }),
      );
    }),
  );

  router.put(
    '/api/inscricoes/:id/anexos/:tipo',
    authenticationGuard,
    requireDiscente,
    pdfBodyParser,
    asyncHandler(async (req, res) => {
      const tipo = anexoTipoSchema.safeParse(req.params['tipo']);
      if (!tipo.success) {
        throw new ValidationError('Tipo de anexo inválido. Use PLANO_TRABALHO ou LATTES.');
      }
      const inscricao = await service.anexar(
        req.params['id'] as string,
        req.user!.id,
        tipo.data,
        readUploadFilename(req),
        readUploadBody(req),
      );
      res.json(
        toInscricaoResponse(await service.view(inscricao), {
          pendencias: await service.pendencias(inscricao),
        }),
      );
    }),
  );

  router.delete(
    '/api/inscricoes/:id/anexos/:anexoId',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      const inscricao = await service.removerAnexo(
        req.params['id'] as string,
        req.user!.id,
        req.params['anexoId'] as string,
      );
      res.json(
        toInscricaoResponse(await service.view(inscricao), {
          pendencias: await service.pendencias(inscricao),
        }),
      );
    }),
  );

  router.get(
    '/api/inscricoes/:id/anexos/:anexoId/arquivo',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const arquivo = await service.lerAnexo(
        req.params['id'] as string,
        req.user!,
        req.params['anexoId'] as string,
      );
      sendPdf(res, arquivo.content, arquivo.nome);
    }),
  );

  router.post(
    '/api/inscricoes/:id/submissao',
    authenticationGuard,
    requireDiscente,
    asyncHandler(async (req, res) => {
      const inscricao = await service.submeter(req.params['id'] as string, req.user!.id);
      res.json(toInscricaoResponse(await service.view(inscricao)));
    }),
  );

  router.post(
    '/api/inscricoes/:id/vinculo',
    authenticationGuard,
    requireDocente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(vinculoSchema, req.body);
      const inscricao = await service.responderVinculo(
        req.params['id'] as string,
        req.user!.id,
        dto.decisao,
        dto.comentario,
      );
      res.json(toInscricaoResponse(await service.view(inscricao)));
    }),
  );
}
