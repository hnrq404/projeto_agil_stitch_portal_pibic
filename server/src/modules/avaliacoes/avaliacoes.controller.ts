import type { NextFunction, Request, Response, Router } from 'express';

import { createRoleGuard, requireGestor } from '@shared/auth/auth.middleware';
import { asyncHandler, parseBody } from '@shared/http/http.middleware';

import type { UsuariosRepository } from '../auth/repositories/usuarios.repository';
import type { InscricaoStatus } from '../inscricoes/domain/inscricoes.types';
import { toInscricaoResponse } from '../inscricoes/dto/inscricoes.dto';
import type { InscricoesService } from '../inscricoes/inscricoes.service';

import { STATUS_TRIAGEM, type AvaliacoesService, type ItemTriagem } from './avaliacoes.service';
import { CRITERIOS, type Avaliacao } from './domain/avaliacoes.types';
import {
  atribuirSchema,
  homologacaoSchema,
  parecerSchema,
  toAvaliacaoResponse,
} from './dto/avaliacoes.dto';

const requireAvaliador = createRoleGuard(['AVALIADOR']);

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Rotas de triagem (GESTOR) e avaliação (AVALIADOR) — S4 e homologação (S5):
 *   GET    /api/triagem?editalId=&status=&subareaCode=   → fila com consolidado
 *   GET    /api/triagem/editais/:editalId/ranking         → ranking por média
 *   GET    /api/triagem/:inscricaoId                      → proposta + pareceres
 *   POST   /api/triagem/:inscricaoId/avaliadores          → atribui avaliadores
 *   DELETE /api/triagem/avaliacoes/:avaliacaoId           → remove atribuição pendente
 *   POST   /api/triagem/:inscricaoId/homologacao          → aprova/recusa
 *   GET    /api/avaliadores                               → avaliadores e carga atual
 *   GET    /api/avaliacoes/criterios                      → rubrica
 *   GET    /api/avaliacoes/minhas                         → minhas atribuições (AVALIADOR)
 *   GET    /api/avaliacoes/:id                            → avaliação + proposta
 *   POST   /api/avaliacoes/:id/parecer                    → envia notas e parecer
 */
export function registerAvaliacoesRoutes(
  router: Router,
  service: AvaliacoesService,
  inscricoesService: InscricoesService,
  usuarios: UsuariosRepository,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  const gestor = [authenticationGuard, requireGestor];

  async function avaliacoesResponse(avaliacoes: readonly Avaliacao[]) {
    const avaliadores = await usuarios.findManyByIds([...new Set(avaliacoes.map((a) => a.avaliadorId))]);
    const byId = new Map(avaliadores.map((u) => [u.id, u]));
    return avaliacoes.map((a) => toAvaliacaoResponse(a, byId.get(a.avaliadorId)));
  }

  async function itensResponse(itens: readonly ItemTriagem[]) {
    // Uma consulta de avaliadores para a fila inteira (antes era uma por proposta).
    const avaliadorIds = [...new Set(itens.flatMap((i) => i.avaliacoes.map((a) => a.avaliadorId)))];
    const [views, avaliadores] = await Promise.all([
      inscricoesService.views(itens.map((i) => i.inscricao)),
      usuarios.findManyByIds(avaliadorIds),
    ]);
    const byId = new Map(avaliadores.map((u) => [u.id, u]));
    return itens.map((item, index) => ({
      inscricao: toInscricaoResponse(views[index]!),
      avaliacoes: item.avaliacoes.map((a) => toAvaliacaoResponse(a, byId.get(a.avaliadorId))),
      consolidado: item.consolidado,
    }));
  }

  router.get(
    '/api/triagem',
    ...gestor,
    asyncHandler(async (req, res) => {
      const status = queryString(req.query['status']);
      const itens = await service.fila({
        editalId: queryString(req.query['editalId']),
        subareaCode: queryString(req.query['subareaCode']),
        status: STATUS_TRIAGEM.includes(status as InscricaoStatus) ? (status as InscricaoStatus) : undefined,
      });
      res.json({ data: await itensResponse(itens), total: itens.length });
    }),
  );

  router.get(
    '/api/triagem/editais/:editalId/ranking',
    ...gestor,
    asyncHandler(async (req, res) => {
      const itens = await service.ranking(req.params['editalId'] as string);
      res.json({ data: await itensResponse(itens), total: itens.length });
    }),
  );

  router.get(
    '/api/triagem/:inscricaoId',
    ...gestor,
    asyncHandler(async (req, res) => {
      const item = await service.itemTriagem(req.params['inscricaoId'] as string);
      const [response] = await itensResponse([item]);
      res.json(response);
    }),
  );

  router.post(
    '/api/triagem/:inscricaoId/avaliadores',
    ...gestor,
    asyncHandler(async (req, res) => {
      const dto = parseBody(atribuirSchema, req.body);
      await service.atribuir(req.params['inscricaoId'] as string, dto.avaliadorIds);
      const item = await service.itemTriagem(req.params['inscricaoId'] as string);
      const [response] = await itensResponse([item]);
      res.status(201).json(response);
    }),
  );

  router.delete(
    '/api/triagem/avaliacoes/:avaliacaoId',
    ...gestor,
    asyncHandler(async (req, res) => {
      await service.removerAtribuicao(req.params['avaliacaoId'] as string);
      res.status(204).end();
    }),
  );

  router.post(
    '/api/triagem/:inscricaoId/homologacao',
    ...gestor,
    asyncHandler(async (req, res) => {
      const dto = parseBody(homologacaoSchema, req.body);
      await service.homologar(req.params['inscricaoId'] as string, dto.decisao, dto.justificativa);
      const item = await service.itemTriagem(req.params['inscricaoId'] as string);
      const [response] = await itensResponse([item]);
      res.json(response);
    }),
  );

  router.get(
    '/api/avaliadores',
    ...gestor,
    asyncHandler(async (_req, res) => {
      const avaliadores = await usuarios.list('AVALIADOR');
      const pendentes = await Promise.all(
        avaliadores.map(async (a) => (await service.minhas(a.id)).filter((x) => x.status === 'PENDENTE').length),
      );
      res.json({
        data: avaliadores.map((a, i) => ({
          id: a.id,
          nome: a.nome,
          departamento: a.departamento,
          pendentes: pendentes[i],
        })),
        total: avaliadores.length,
      });
    }),
  );

  router.get(
    '/api/avaliacoes/criterios',
    authenticationGuard,
    (_req, res) => {
      res.json({ data: CRITERIOS });
    },
  );

  router.get(
    '/api/avaliacoes/minhas',
    authenticationGuard,
    requireAvaliador,
    asyncHandler(async (req, res) => {
      const avaliacoes = await service.minhas(req.user!.id);
      const inscricoes = await Promise.all(avaliacoes.map((a) => inscricoesService.getById(a.inscricaoId)));
      const views = await inscricoesService.views(inscricoes);
      const avaliacoesResp = await avaliacoesResponse(avaliacoes);
      res.json({
        data: avaliacoesResp.map((a, i) => ({ ...a, inscricao: toInscricaoResponse(views[i]!) })),
        total: avaliacoes.length,
      });
    }),
  );

  router.get(
    '/api/avaliacoes/:id',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const avaliacao = await service.getForActor(req.params['id'] as string, req.user!);
      const inscricao = await inscricoesService.getById(avaliacao.inscricaoId);
      const view = await inscricoesService.view(inscricao);
      const [avaliacaoResp] = await avaliacoesResponse([avaliacao]);
      res.json({
        ...avaliacaoResp,
        inscricao: toInscricaoResponse(view),
        criterios: CRITERIOS,
      });
    }),
  );

  router.post(
    '/api/avaliacoes/:id/parecer',
    authenticationGuard,
    requireAvaliador,
    asyncHandler(async (req, res) => {
      const dto = parseBody(parecerSchema, req.body);
      const avaliacao = await service.emitirParecer(
        req.params['id'] as string,
        req.user!.id,
        dto.notas,
        dto.parecer,
      );
      const [response] = await avaliacoesResponse([avaliacao]);
      res.json(response);
    }),
  );
}

