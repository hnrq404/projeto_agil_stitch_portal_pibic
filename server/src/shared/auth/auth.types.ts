/**
 * Papéis de acesso do portal — RN11 (Backlog): o acesso é determinado exclusivamente pelo papel.
 *
 * - DISCENTE  : aluno que se inscreve nos editais e submete relatórios
 * - DOCENTE   : orientador; confirma vínculos e avalia relatórios dos orientandos
 * - AVALIADOR : emite pareceres com rubrica nas propostas atribuídas
 * - GESTOR    : PRPq; gerencia editais, triagem, homologação e usuários
 * - ADMIN     : operador de sistema (mesmas permissões do GESTOR)
 * - USUARIO   : visitante cadastrado, apenas consulta a parte pública
 */
export const USER_ROLES = ['DISCENTE', 'DOCENTE', 'AVALIADOR', 'GESTOR', 'ADMIN', 'USUARIO'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Apenas GESTOR (e ADMIN, como operador de sistema) gerencia editais — Sprint 2, RBAC. */
export const GESTOR_ROLES: readonly UserRole[] = ['GESTOR', 'ADMIN'];

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
}

export function isGestorRole(role: UserRole): boolean {
  return GESTOR_ROLES.includes(role);
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;
  constructor(message = 'Autenticação obrigatória (envie o header Authorization: Bearer <token>).') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
