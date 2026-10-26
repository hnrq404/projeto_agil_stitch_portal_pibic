import type { NextFunction, Request, Response, Router } from 'express';

import { asyncHandler, parseBody } from '@shared/http/http.middleware';
import { confirmarEnvioSchema } from '@shared/storage/arquivo.dto';

import type { PerfilService } from './perfil.service';

/**
 * "Meu perfil" (usuário logado):
 *   POST /api/perfil/curriculo/envio → autoriza o envio do Lattes (aluno)
 *   PUT  /api/perfil/curriculo       → { chave, nome }: confere o PDF e troca o currículo
 *   GET  /api/perfil/curriculo       → { nome, url }: link temporário do próprio currículo
 */
export function registerPerfilRoutes(
  router: Router,
  service: PerfilService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.post(
    '/api/perfil/curriculo/envio',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      res.json(await service.prepararCurriculo(req.user!.id));
    }),
  );

  router.put(
    '/api/perfil/curriculo',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const dto = parseBody(confirmarEnvioSchema, req.body);
      res.json(await service.confirmarCurriculo(req.user!.id, dto.chave, dto.nome));
    }),
  );

  router.get(
    '/api/perfil/curriculo',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      res.json(await service.linkCurriculo(req.user!.id));
    }),
  );
}
