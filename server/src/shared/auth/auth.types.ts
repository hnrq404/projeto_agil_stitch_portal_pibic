/**
 * Papéis de acesso do portal — RN11 (Backlog): o acesso é determinado exclusivamente pelo papel.
 *
 * - DISCENTE  : aluno; candidata-se aos projetos divulgados e envia os relatórios mensais
 * - DOCENTE   : professor; divulga projetos, seleciona o aluno, envia ao edital indicando
 *               três avaliadores e avalia projetos de colegas (não há papel de avaliador separado)
 * - GESTOR    : PRPq/UNICAP; abre editais, acompanha a avaliação, homologa e gerencia usuários
 * - ADMIN     : operador de sistema (mesmas permissões do GESTOR)
 * - USUARIO   : visitante cadastrado, apenas consulta a parte pública
 */
export const USER_ROLES = ['DISCENTE', 'DOCENTE', 'GESTOR', 'ADMIN', 'USUARIO'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Apenas GESTOR (e ADMIN, como operador de sistema) gerencia editais — Sprint 2, RBAC. */
export const GESTOR_ROLES: readonly UserRole[] = ['GESTOR', 'ADMIN'];

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
}

/**
 * Papel antigo, unificado ao DOCENTE. Contas gravadas com ele continuam
 * entrando: o repositório converte na leitura e o seed migra as linhas.
 */
export const LEGACY_AVALIADOR_ROLE = 'AVALIADOR';

export function normalizeRole(role: string): UserRole {
  return (role === LEGACY_AVALIADOR_ROLE ? 'DOCENTE' : role) as UserRole;
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
