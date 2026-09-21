/** Papéis disponíveis no auto-cadastro (Sprint 2): gestor do edital ou visitante. */
export type RegistroRole = 'GESTOR' | 'USUARIO';

/** Entidade Usuario — persistida com hash bcrypt (o hash nunca atravessa a API). */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  role: RegistroRole;
  criadoEm: Date;
}

/** Representação pública do usuário (sem hash de senha). */
export interface PublicUsuario {
  id: string;
  nome: string;
  email: string;
  role: RegistroRole;
  criadoEm: string;
}

/** Payload embutido no JWT emitido no login. */
export interface JwtPayload {
  sub: string;
  nome: string;
  email: string;
  role: RegistroRole;
}

/** Resposta do POST /auth/login e /auth/register. */
export interface AuthResult {
  token: string;
  usuario: PublicUsuario;
}
