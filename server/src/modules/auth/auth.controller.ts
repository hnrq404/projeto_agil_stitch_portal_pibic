import type { Router } from 'express';

import { asyncHandler, parseBody } from '@shared/http/http.middleware';
import { UnauthorizedError } from '@shared/auth/auth.types';

import { AuthService } from './auth.service';
import { loginSchema, registerSchema, toAuthResponse } from './dto/auth.dto';

/**
 * Rotas de autenticação:
 *   POST /api/auth/register → cria conta (bcrypt) e já retorna JWT
 *   POST /api/auth/login    → autentica e retorna JWT
 *   GET  /api/auth/me       → perfil do portador do JWT (bootstrap da SPA)
 */
export function registerAuthRoutes(
  router: Router,
  service: AuthService,
): void {
  router.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
      const dto = parseBody(registerSchema, req.body);
      const result = await service.register(dto);
      res.status(201).json(toAuthResponse(result));
    }),
  );

  router.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const dto = parseBody(loginSchema, req.body);
      const result = await service.login(dto);
      res.json(toAuthResponse(result));
    }),
  );

  router.get(
    '/api/auth/me',
    asyncHandler(async (req, res, next) => {
      try {
        const header = req.headers.authorization;
        if (!header) {
          throw new UnauthorizedError();
        }
        const token = header.replace(/^Bearer\s+/i, '').trim();
        const usuario = await service.resolveToken(token);
        res.json({ usuario });
      } catch (error) {
        next(error);
      }
    }),
  );
}
