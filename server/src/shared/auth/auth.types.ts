/** Papéis de acesso do portal — RN11 (Backlog): o acesso é determinado exclusivamente pelo papel. */
export type UserRole = 'DISCENTE' | 'DOCENTE' | 'AVALIADOR' | 'GESTOR' | 'ADMIN';

/** Apenas GESTOR (e ADMIN, como operador de sistema) gerencia editais — Sprint 2, RBAC. */
export const GESTOR_ROLES: readonly UserRole[] = ['GESTOR', 'ADMIN'];

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;
  constructor(message = 'Autenticação obrigatória (envie o header Authorization: Bearer <token>).') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
