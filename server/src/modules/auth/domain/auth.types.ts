import type { UserRole } from '@shared/auth/auth.types';

/**
 * Papéis disponíveis no auto-cadastro. GESTOR e AVALIADOR são atribuídos pela
 * gestão (S1.2), nunca escolhidos pelo próprio usuário.
 */
export const REGISTRO_ROLES = ['DISCENTE', 'DOCENTE', 'USUARIO'] as const;

export type RegistroRole = (typeof REGISTRO_ROLES)[number];

/** Entidade Usuario — persistida com hash bcrypt (o hash nunca atravessa a API). */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  role: UserRole;
  /** Departamento/unidade (ex.: "DCC"). Usado na checagem de conflito de interesse. */
  departamento: string;
  /** Matrícula institucional (discentes). Mascarada em exportações (RN09). */
  matricula: string | null;
  criadoEm: Date;
}

/** Representação pública do usuário (sem hash de senha). */
export interface PublicUsuario {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  departamento: string;
  matricula: string | null;
  criadoEm: string;
}

/** Payload embutido no JWT emitido no login. */
export interface JwtPayload {
  sub: string;
  nome: string;
  email: string;
  role: UserRole;
}

/** Resposta do POST /auth/login e /auth/register. */
export interface AuthResult {
  token: string;
  usuario: PublicUsuario;
}
