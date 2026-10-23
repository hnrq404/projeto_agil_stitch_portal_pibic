import type { NextFunction, Request, Response, Router } from 'express';

import { createRoleGuard } from '@shared/auth/auth.middleware';
import { asyncHandler, parseBody } from '@shared/http/http.middleware';
import { ValidationError } from '@shared/errors/domain.errors';
import { confirmarEnvioSchema } from '@shared/storage/arquivo.dto';

import type { InscricoesService } from './inscricoes.service';
import type { Inscricao } from './domain/inscricoes.types';
import {
  anexoTipoSchema,
  candidaturaSchema,
  criarInscricaoSchema,
  rascunhoSchema,
  selecaoSchema,
  submissaoSchema,
  toCandidaturaResponse,
  toInscricaoResponse,
} from './dto/inscricoes.dto';

const requireDiscente = createRoleGuard(['DISCENTE']);
const requireDocente = createRoleGuard(['DOCENTE']);

/**
 * Projetos de pesquisa (fluxo UNICAP):
 *
 * Professor (DOCENTE)
 *   POST   /api/inscricoes                           → cria o rascunho num edital aberto
 *   GET    /api/inscricoes/minhas                    → meus projetos, de qualquer status
 *   PATCH  /api/inscricoes/:id                       → auto-save (até o envio ao edital)
 *   POST   /api/inscricoes/:id/anexos/:tipo/envio    → autoriza o envio do PDF direto ao armazenamento
 *   PUT    /api/inscricoes/:id/anexos/:tipo          → { chave, nome }: confere o PDF enviado e o registra
 *   DELETE /api/inscricoes/:id/anexos/:anexoId       → remove anexo
 *   POST   /api/inscricoes/:id/divulgacao            → divulga aos alunos
 *   GET    /api/inscricoes/:id/candidaturas          → candidatos do projeto
 *   POST   /api/inscricoes/:id/selecao               → escolhe o aluno
 *   POST   /api/inscricoes/:id/submissao             → envia ao edital com três avaliadores (gera protocolo)
 *
 * Aluno (DISCENTE)
 *   POST   /api/inscricoes/:id/candidaturas          → candidata-se a um projeto divulgado
 *   GET    /api/candidaturas/minhas                  → minhas candidaturas
 *   DELETE /api/candidaturas/:id                     → desiste (enquanto pendente)
 *
 * Todos com acesso ao projeto
 *   GET    /api/inscricoes/:id                       → detalhe (professor, aluno selecionado, avaliador, gestor)
 *   GET    /api/inscricoes/:id/anexos/:anexoId/arquivo → { nome, url }: link temporário para abrir o PDF
 */
export function registerInscricoesRoutes(
  router: Router,
  service: InscricoesService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  const docente = [authenticationGuard, requireDocente];
  const discente = [authenticationGuard, requireDiscente];

  /** Resposta do professor dono: inclui o checklist de envio enquanto o projeto é editável. */
  async function respostaDoDono(inscricao: Inscricao) {
    const editavel = inscricao.status === 'RASCUNHO' || inscricao.status === 'DIVULGADA';
    return toInscricaoResponse(await service.view(inscricao), {
      pendencias: editavel ? await service.pendencias(inscricao) : undefined,
    });
  }

  router.post(
    '/api/inscricoes',
    ...docente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(criarInscricaoSchema, req.body);
      const inscricao = await service.criarRascunho(req.user!.id, dto.editalId);
      res.status(201).json(await respostaDoDono(inscricao));
    }),
  );

  router.get(
    '/api/inscricoes/minhas',
    ...docente,
    asyncHandler(async (req, res) => {
      const views = await service.views(await service.listDoOrientador(req.user!.id));
      res.json({ data: views.map((v) => toInscricaoResponse(v)), total: views.length });
    }),
  );

  router.get(
    '/api/candidaturas/minhas',
    ...discente,
    asyncHandler(async (req, res) => {
      const views = await service.minhasCandidaturas(req.user!.id);
      res.json({ data: views.map(toCandidaturaResponse), total: views.length });
    }),
  );

  router.delete(
    '/api/candidaturas/:id',
    ...discente,
    asyncHandler(async (req, res) => {
      await service.cancelarCandidatura(req.params['id'] as string, req.user!.id);
      res.status(204).end();
    }),
  );

  router.get(
    '/api/inscricoes/:id',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const inscricao = await service.getForActor(req.params['id'] as string, req.user!);
      if (inscricao.orientadorId === req.user!.id) {
        res.json(await respostaDoDono(inscricao));
        return;
      }
      res.json(toInscricaoResponse(await service.view(inscricao)));
    }),
  );

  router.patch(
    '/api/inscricoes/:id',
    ...docente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(rascunhoSchema, req.body);
      const inscricao = await service.atualizarRascunho(req.params['id'] as string, req.user!.id, dto);
      res.json(await respostaDoDono(inscricao));
    }),
  );

  function parseAnexoTipo(valor: unknown) {
    const tipo = anexoTipoSchema.safeParse(valor);
    if (!tipo.success) {
      throw new ValidationError('Tipo de anexo inválido. Use PLANO_TRABALHO ou LATTES.');
    }
    return tipo.data;
  }

  router.post(
    '/api/inscricoes/:id/anexos/:tipo/envio',
    ...docente,
    asyncHandler(async (req, res) => {
      const tipo = parseAnexoTipo(req.params['tipo']);
      res.json(await service.prepararAnexo(req.params['id'] as string, req.user!.id, tipo));
    }),
  );

  router.put(
    '/api/inscricoes/:id/anexos/:tipo',
    ...docente,
    asyncHandler(async (req, res) => {
      const tipo = parseAnexoTipo(req.params['tipo']);
      const dto = parseBody(confirmarEnvioSchema, req.body);
      const inscricao = await service.anexar(req.params['id'] as string, req.user!.id, tipo, dto.chave, dto.nome);
      res.json(await respostaDoDono(inscricao));
    }),
  );

  router.delete(
    '/api/inscricoes/:id/anexos/:anexoId',
    ...docente,
    asyncHandler(async (req, res) => {
      const inscricao = await service.removerAnexo(
        req.params['id'] as string,
        req.user!.id,
        req.params['anexoId'] as string,
      );
      res.json(await respostaDoDono(inscricao));
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
      res.json(arquivo);
    }),
  );

  router.post(
    '/api/inscricoes/:id/divulgacao',
    ...docente,
    asyncHandler(async (req, res) => {
      const inscricao = await service.divulgar(req.params['id'] as string, req.user!.id);
      res.json(await respostaDoDono(inscricao));
    }),
  );

  router.get(
    '/api/inscricoes/:id/candidaturas',
    ...docente,
    asyncHandler(async (req, res) => {
      const views = await service.candidaturasDoProjeto(req.params['id'] as string, req.user!.id);
      res.json({ data: views.map(toCandidaturaResponse), total: views.length });
    }),
  );

  router.post(
    '/api/inscricoes/:id/candidaturas',
    ...discente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(candidaturaSchema, req.body);
      const criada = await service.candidatar(req.params['id'] as string, req.user!.id, dto.mensagem);
      res.status(201).json(toCandidaturaResponse(criada));
    }),
  );

  router.post(
    '/api/inscricoes/:id/selecao',
    ...docente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(selecaoSchema, req.body);
      const inscricao = await service.selecionar(req.params['id'] as string, req.user!.id, dto.candidaturaId);
      res.json(await respostaDoDono(inscricao));
    }),
  );

  router.post(
    '/api/inscricoes/:id/submissao',
    ...docente,
    asyncHandler(async (req, res) => {
      const dto = parseBody(submissaoSchema, req.body);
      const inscricao = await service.submeter(req.params['id'] as string, req.user!.id, dto.avaliadorIds);
      res.json(toInscricaoResponse(await service.view(inscricao)));
    }),
  );
}
