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
 * Sprint 1 (M1) entregará o Convex Auth real; até lá o guard aceita tokens
 * `Bearer <userSeedId>` resolvendo o usuário a partir de um UserDirectory
 * (implementado com o seed em memória/testes e, em produção, pelo serviço de
 * identidade). A assinatura do guard não muda quando o provedor trocar.
 */
export interface UserDirectory {
  resolveUser(token: string): AuthenticatedUser | undefined;
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
    try {
      const token = extractBearerToken(req.headers.authorization);
      const user = directory.resolveUser(token);
      if (!user) {
        throw new UnauthorizedError('Token inválido ou usuário inexistente.');
      }
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
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
