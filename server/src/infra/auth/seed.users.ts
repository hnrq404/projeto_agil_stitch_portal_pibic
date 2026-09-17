import type { AuthenticatedUser } from '@shared/auth/auth.types';

/**
 * Usuários do seed — resolvem o guard Bearer (`Authorization: Bearer gestor-token`)
 * até que a Sprint 1 (Convex Auth) forneça o provedor de identidade real.
 * Em produção, UserDirectory é implementado pelo serviço de identidade.
 */
export const SEED_USERS: readonly (AuthenticatedUser & { token: string })[] = [
  {
    id: 'user-gestor',
    name: 'Maria Gestora',
    email: 'gestor@pibic.edu.br',
    role: 'GESTOR',
    token: 'gestor-token',
  },
  {
    id: 'user-avaliador',
    name: 'Carlos Avaliador',
    email: 'avaliador@pibic.edu.br',
    role: 'AVALIADOR',
    token: 'avaliador-token',
  },
  {
    id: 'user-discente',
    name: 'Ana Discente',
    email: 'discente@pibic.edu.br',
    role: 'DISCENTE',
    token: 'discente-token',
  },
  {
    id: 'user-docente',
    name: 'Paulo Docente',
    email: 'docente@pibic.edu.br',
    role: 'DOCENTE',
    token: 'docente-token',
  },
] as const;

/** Adapter para o guard de autenticação (resolve token → usuário). */
export function createSeedUserDirectory(): {
  resolveUser(token: string): AuthenticatedUser | undefined;
  listUsers(): { id: string }[];
} {
  const byToken = new Map(SEED_USERS.map((user) => [user.token, user]));
  return {
    resolveUser: (token) => byToken.get(token),
    listUsers: () => SEED_USERS.map(({ id }) => ({ id })),
  };
}
