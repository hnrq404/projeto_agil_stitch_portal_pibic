import type { UserRole } from '@shared/auth/auth.types';

/**
 * Papéis disponíveis no auto-cadastro. GESTOR é atribuído pela
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
  /** Departamento/unidade (ex.: "DCC"). */
  departamento: string;
  /** Matrícula institucional (discentes). Mascarada em exportações (RN09). */
  matricula: string | null;
  criadoEm: Date;
  /** Última troca de senha; tokens emitidos antes dela são recusados. */
  senhaAlteradaEm?: Date | null;
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
  /**
   * Momento da emissão em milissegundos. O `iat` padrão do JWT é em segundos,
   * o que deixaria passar um token antigo emitido no mesmo segundo da troca de senha.
   */
  emitidoEm?: number;
  /** Preenchido pelo jsonwebtoken (segundos). */
  iat?: number;
}

/** Resposta do POST /auth/login e /auth/register. */
export interface AuthResult {
  token: string;
  usuario: PublicUsuario;
}
