import type { NextFunction, Request, Response } from 'express';

import {
  GESTOR_ROLES,
  UnauthorizedError,
  type AuthenticatedUser,
  type UserRole,
} from './auth.types';
import { ForbiddenError } from '../errors/domain.errors';

/**
 * Camada de autenticação/autorização (RBAC).
 *
 * O guard resolve o token Bearer por meio de um UserDirectory: em produção o
 * JwtUserDirectory (verifica o JWT e recarrega o usuário do banco, para que uma
 * troca de papel valha na próxima requisição — RN11); nos testes, directories
 * falsos síncronos. A porta aceita retorno síncrono ou assíncrono.
 */
export interface UserDirectory {
  resolveUser(
    token: string,
  ): AuthenticatedUser | undefined | Promise<AuthenticatedUser | undefined>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function extractBearerToken(header: string | undefined): string {
  if (!header) {
    throw new UnauthorizedError();
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) {
    throw new UnauthorizedError('Formato inválido. Use: Authorization: Bearer <token>.');
  }
  return match[1] as string;
}

export function createAuthenticationGuard(directory: UserDirectory) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    let token: string;
    try {
      token = extractBearerToken(req.headers.authorization);
    } catch (error) {
      next(error);
      return;
    }
    Promise.resolve(directory.resolveUser(token))
      .then((user) => {
        if (!user) {
          throw new UnauthorizedError('Token inválido ou usuário inexistente.');
        }
        req.user = user;
        next();
      })
      .catch(next);
  };
}

export function createRoleGuard(allowedRoles: readonly UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(
          `Operação permitida apenas para papéis: ${allowedRoles.join(', ')}.`,
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Guard pronto para as rotas administrativas de edital (perfil GESTOR). */
export const requireGestor = createRoleGuard(GESTOR_ROLES);
