import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { ConflictError, ValidationError } from '@shared/errors/domain.errors';
import { UnauthorizedError } from '@shared/auth/auth.types';

import type { AuthResult, JwtPayload, PublicUsuario, RegistroRole, Usuario } from './domain/auth.types';
import type { UsuariosRepository } from './repositories/usuarios.repository';

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8h de sessão

/** Contrato mínimo para emitir/verificar JWT — permite mock determinístico nos testes. */
export interface TokenSigner {
  sign(payload: JwtPayload): string;
  verify(token: string): JwtPayload;
}

/** Implementação real com jsonwebtoken (HS256). */
export class JwtTokenSigner implements TokenSigner {
  constructor(private readonly secret: string) {}

  sign(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: TOKEN_TTL_SECONDS });
  }

  verify(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Token inválido ou expirado. Faça login novamente.');
    }
  }
}

export interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
  role: RegistroRole;
}

function toPublic(usuario: Usuario): PublicUsuario {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    criadoEm: usuario.criadoEm.toISOString(),
  };
}

/**
 * Casos de uso de autenticação: cadastro (bcrypt) e login (JWT).
 * O mesmo usuário cadastrado em register autentica em login — garantido pelo
 * repositório compartilhado + comparação bcrypt.
 */
export class AuthService {
  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly signer: TokenSigner,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.usuarios.findByEmail(email);
    if (existing) {
      throw new ConflictError('Já existe uma conta com este e-mail.', { email });
    }

    const senhaHash = await bcrypt.hash(input.senha, BCRYPT_ROUNDS);
    const usuario = await this.usuarios.create({
      id: crypto.randomUUID(),
      nome: input.nome.trim(),
      email,
      senhaHash,
      role: input.role,
      // bcrypt já impõe custo; criadoEm é preenchido pelo repositório/banco
      criadoEm: new Date(),
    });

    return this.issueToken(usuario);
  }

  async login(input: { email: string; senha: string }): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const usuario = await this.usuarios.findByEmail(email);
    if (!usuario) {
      throw new UnauthorizedError('E-mail ou senha incorretos.');
    }

    const ok = await bcrypt.compare(input.senha, usuario.senhaHash);
    if (!ok) {
      throw new UnauthorizedError('E-mail ou senha incorretos.');
    }

    return this.issueToken(usuario);
  }

  /** Resolve um token Bearer para o guard de autenticação (UserDirectory). */
  async resolveToken(token: string): Promise<PublicUsuario> {
    const payload = this.signer.verify(token);
    const usuario = await this.usuarios.findById(payload.sub);
    if (!usuario) {
      throw new UnauthorizedError('Token válido, mas usuário não existe mais.');
    }
    return toPublic(usuario);
  }

  /** Versão síncrona (só verifica a assinatura JWT) — usada pelo guard. */
  verifyTokenSync(token: string): JwtPayload {
    return this.signer.verify(token);
  }

  private issueToken(usuario: Usuario): AuthResult {
    const token = this.signer.sign({
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    });
    return { token, usuario: toPublic(usuario) };
  }

  /** Helper para seeds/testes: cria usuário já com hash bcrypt. */
  static async hashSenha(senha: string): Promise<string> {
    return bcrypt.hash(senha, BCRYPT_ROUNDS);
  }
}

/** Valida política mínima de senha — usada pelo DTO Zod. */
export function assertSenhaForte(senha: string): void {
  if (senha.length < 6) {
    throw new ValidationError('A senha deve ter ao menos 6 caracteres.');
  }
}
