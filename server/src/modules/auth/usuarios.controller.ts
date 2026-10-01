import type { NextFunction, Request, Response, Router } from 'express';

import { asyncHandler, parseBody } from '@shared/http/http.middleware';
import { requireGestor } from '@shared/auth/auth.middleware';
import { USER_ROLES, type UserRole } from '@shared/auth/auth.types';

import { toPublicUsuario } from './auth.service';
import { updateUsuarioSchema } from './dto/auth.dto';
import type { UsuariosService } from './usuarios.service';

function parseRoleFilter(value: unknown): UserRole | undefined {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
    ? (value as UserRole)
    : undefined;
}

/**
 * Rotas de usuários:
 *   GET   /api/usuarios?role=        → lista (GESTOR)
 *   PATCH /api/usuarios/:id          → altera papel/departamento (GESTOR)
 *   GET   /api/usuarios/docentes     → orientadores disponíveis (qualquer autenticado)
 */
export function registerUsuariosRoutes(
  router: Router,
  service: UsuariosService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.get(
    '/api/usuarios/docentes',
    authenticationGuard,
    asyncHandler(async (_req, res) => {
      const docentes = await service.list('DOCENTE');
      res.json({
        data: docentes.map((d) => ({ id: d.id, nome: d.nome, departamento: d.departamento })),
        total: docentes.length,
      });
    }),
  );

  router.get(
    '/api/usuarios',
    authenticationGuard,
    requireGestor,
    asyncHandler(async (req, res) => {
      const usuarios = await service.list(parseRoleFilter(req.query['role']));
      res.json({ data: usuarios.map(toPublicUsuario), total: usuarios.length });
    }),
  );

  router.patch(
    '/api/usuarios/:id',
    authenticationGuard,
    requireGestor,
    asyncHandler(async (req, res) => {
      const dto = parseBody(updateUsuarioSchema, req.body);
      const usuario = await service.update(req.user!.id, req.params['id'] as string, dto);
      res.json(toPublicUsuario(usuario));
    }),
  );
}
