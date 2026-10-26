import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import {
  ConflictError,
  EmailNaoConfirmadoError,
  ServicoIndisponivelError,
  ValidationError,
} from '@shared/errors/domain.errors';
import { UnauthorizedError } from '@shared/auth/auth.types';
import { MemoryEmailSender, type EmailSender } from '@shared/email/email.sender';

import { emailConfirmacao, emailRedefinicaoSenha } from './conta.emails';
import type { AuthResult, JwtPayload, PublicUsuario, RegistroRole, Usuario } from './domain/auth.types';
import {
  assertTokenValido,
  gerarTokenEmail,
  lerTokenEmail,
  VALIDADE_SENHA_MS,
  VALIDADE_VERIFICACAO_MS,
} from './domain/token-email';
import type { UsuariosRepository } from './repositories/usuarios.repository';

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8h de sessão
/** Hash de uma senha aleatória, com o mesmo custo dos reais: usado no login de e-mail inexistente. */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), BCRYPT_ROUNDS);

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
  departamento?: string;
  matricula?: string;
}

/** Resultado do cadastro: a conta existe, mas só entra depois de confirmar o e-mail. */
export interface CadastroResult {
  usuario: Usuario;
  /** false quando o servidor de e-mail falhou; a pessoa pode pedir o reenvio do link. */
  emailEnviado: boolean;
}

export interface AuthServiceOptions {
  email?: EmailSender;
  /** Endereço do site, usado nos links enviados por e-mail. */
  urlApp?: string;
  agora?: () => Date;
}

export function toPublicUsuario(usuario: Usuario): PublicUsuario {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    departamento: usuario.departamento,
    matricula: usuario.matricula,
    criadoEm: usuario.criadoEm.toISOString(),
    curriculo: usuario.curriculo
      ? {
          nome: usuario.curriculo.nome,
          tamanho: usuario.curriculo.tamanho,
          enviadoEm: usuario.curriculo.enviadoEm.toISOString(),
        }
      : null,
  };
}

/**
 * Casos de uso da conta: cadastro com confirmação por e-mail, login (JWT),
 * troca e redefinição de senha.
 */
export class AuthService {
  private readonly email: EmailSender;
  private readonly urlApp: string;
  private readonly agora: () => Date;

  constructor(
    private readonly usuarios: UsuariosRepository,
    private readonly signer: TokenSigner,
    opcoes: AuthServiceOptions = {},
  ) {
    this.email = opcoes.email ?? new MemoryEmailSender();
    this.urlApp = (opcoes.urlApp ?? 'http://localhost:5173').replace(/\/+$/, '');
    this.agora = opcoes.agora ?? (() => new Date());
  }

  /**
   * Cria a conta como pendente e envia o link de confirmação. Só quem abre a
   * caixa de entrada do e-mail informado consegue ativar a conta.
   */
  async register(input: RegisterInput): Promise<CadastroResult> {
    this.assertEmailDisponivel();
    const email = input.email.trim().toLowerCase();

    const existing = await this.usuarios.findByEmail(email);
    if (existing) {
      throw new ConflictError(
        existing.emailPendente
          ? 'Este e-mail já foi cadastrado e aguarda confirmação. Na tela de entrada, use "Reenviar link de confirmação".'
          : 'Já existe uma conta com este e-mail.',
        { email },
      );
    }

    const id = crypto.randomUUID();
    const { token, registro } = gerarTokenEmail(id, VALIDADE_VERIFICACAO_MS, this.agora());
    const usuario = await this.usuarios.create({
      id,
      nome: input.nome.trim(),
      email,
      senhaHash: await bcrypt.hash(input.senha, BCRYPT_ROUNDS),
      role: input.role,
      departamento: input.departamento?.trim().toUpperCase() ?? '',
      matricula: input.matricula?.trim() || null,
      criadoEm: this.agora(),
      emailPendente: true,
      tokenVerificacao: registro,
    });

    const emailEnviado = await this.tentarEnviar(() =>
      this.email.enviar(emailConfirmacao(usuario.nome, usuario.email, this.link('/verificar-email', token))),
    );
    return { usuario, emailEnviado };
  }

  /** Link de confirmação clicado: ativa a conta e já inicia a sessão. */
  async verificarEmail(token: string): Promise<AuthResult> {
    const { usuarioId, segredo } = lerTokenEmail(token);
    const usuario = await this.usuarios.findById(usuarioId);
    if (usuario && !usuario.emailPendente) {
      throw new ValidationError('Este e-mail já foi confirmado. Entre com seu e-mail e senha.');
    }
    assertTokenValido(usuario?.tokenVerificacao, segredo, this.agora());

    const ativado = await this.usuarios.update({ ...usuario!, emailPendente: false, tokenVerificacao: null });
    return this.issueToken(ativado);
  }

  /** Novo link de confirmação. Responde igual exista ou não a conta, para não revelar e-mails cadastrados. */
  async reenviarVerificacao(emailInformado: string): Promise<void> {
    this.assertEmailDisponivel();
    const usuario = await this.usuarios.findByEmail(emailInformado.trim().toLowerCase());
    if (!usuario?.emailPendente) return;

    const { token, registro } = gerarTokenEmail(usuario.id, VALIDADE_VERIFICACAO_MS, this.agora());
    await this.usuarios.update({ ...usuario, tokenVerificacao: registro });
    await this.tentarEnviar(() =>
      this.email.enviar(emailConfirmacao(usuario.nome, usuario.email, this.link('/verificar-email', token))),
    );
  }

  async login(input: { email: string; senha: string }): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const usuario = await this.usuarios.findByEmail(email);
    // Compara mesmo sem usuário (contra um hash fictício): o tempo de resposta
    // não revela quais e-mails têm conta.
    const ok = await bcrypt.compare(input.senha, usuario?.senhaHash ?? DUMMY_HASH);
    if (!usuario || !ok) {
      throw new UnauthorizedError('E-mail ou senha incorretos.');
    }
    // Só depois de a senha conferir: assim não revela se um e-mail qualquer está pendente.
    if (usuario.emailPendente) {
      throw new EmailNaoConfirmadoError();
    }

    return this.issueToken(usuario);
  }

  /** "Esqueci minha senha": envia o link de redefinição. Responde igual exista ou não a conta. */
  async esqueciSenha(emailInformado: string): Promise<void> {
    this.assertEmailDisponivel();
    const usuario = await this.usuarios.findByEmail(emailInformado.trim().toLowerCase());
    if (!usuario) return;

    const { token, registro } = gerarTokenEmail(usuario.id, VALIDADE_SENHA_MS, this.agora());
    await this.usuarios.update({ ...usuario, tokenSenha: registro });
    await this.tentarEnviar(() =>
      this.email.enviar(emailRedefinicaoSenha(usuario.nome, usuario.email, this.link('/redefinir-senha', token))),
    );
  }

  /**
   * Nova senha pelo link do e-mail. Encerra as outras sessões e, como o link
   * prova que a pessoa tem acesso ao e-mail, também confirma uma conta pendente.
   */
  async redefinirSenha(token: string, novaSenha: string): Promise<AuthResult> {
    const { usuarioId, segredo } = lerTokenEmail(token);
    const usuario = await this.usuarios.findById(usuarioId);
    assertTokenValido(usuario?.tokenSenha, segredo, this.agora());

    const atualizado = await this.usuarios.update({
      ...usuario!,
      senhaHash: await bcrypt.hash(novaSenha, BCRYPT_ROUNDS),
      senhaAlteradaEm: this.agora(),
      tokenSenha: null,
      emailPendente: false,
      tokenVerificacao: null,
    });
    return this.issueToken(atualizado);
  }

  /**
   * Troca de senha pelo próprio usuário. Exige a senha atual e invalida os
   * tokens emitidos antes (outras abas e aparelhos); devolve um token novo
   * para a sessão atual continuar.
   */
  async alterarSenha(usuarioId: string, input: { senhaAtual: string; novaSenha: string }): Promise<AuthResult> {
    const usuario = await this.usuarios.findById(usuarioId);
    if (!usuario) {
      throw new UnauthorizedError('Token válido, mas usuário não existe mais.');
    }
    // 400 e não 401: na SPA, um 401 encerra a sessão, e aqui o usuário só errou a senha.
    if (!(await bcrypt.compare(input.senhaAtual, usuario.senhaHash))) {
      throw new ValidationError('A senha atual está incorreta.');
    }
    if (input.senhaAtual === input.novaSenha) {
      throw new ValidationError('A nova senha deve ser diferente da atual.');
    }

    const atualizado = await this.usuarios.update({
      ...usuario,
      senhaHash: await bcrypt.hash(input.novaSenha, BCRYPT_ROUNDS),
      senhaAlteradaEm: this.agora(),
    });
    return this.issueToken(atualizado);
  }

  /** Resolve um token Bearer para o guard de autenticação (UserDirectory). */
  async resolveToken(token: string): Promise<PublicUsuario> {
    const payload = this.signer.verify(token);
    const usuario = await this.usuarios.findById(payload.sub);
    if (!usuario) {
      throw new UnauthorizedError('Token válido, mas usuário não existe mais.');
    }
    if (usuario.senhaAlteradaEm) {
      const emitidoEm = payload.emitidoEm ?? (payload.iat ?? 0) * 1000;
      if (emitidoEm < usuario.senhaAlteradaEm.getTime()) {
        throw new UnauthorizedError('Sua senha foi alterada. Entre novamente.');
      }
    }
    return toPublicUsuario(usuario);
  }

  private issueToken(usuario: Usuario): AuthResult {
    const token = this.signer.sign({
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      emitidoEm: Date.now(),
    });
    return { token, usuario: toPublicUsuario(usuario) };
  }

  private link(caminho: string, token: string): string {
    return `${this.urlApp}${caminho}?token=${encodeURIComponent(token)}`;
  }

  private assertEmailDisponivel(): void {
    if (!this.email.disponivel) {
      throw new ServicoIndisponivelError(
        'O envio de e-mails não está configurado, então não dá para confirmar contas agora. Avise a gestão do programa.',
      );
    }
  }

  /** Falha no envio não desfaz a conta: a pessoa pode pedir o reenvio do link. */
  private async tentarEnviar(enviar: () => Promise<void>): Promise<boolean> {
    try {
      await enviar();
      return true;
    } catch (error) {
      console.error('[auth] Não foi possível enviar o e-mail', error);
      return false;
    }
  }

  /** Helper para seeds/testes: cria usuário já com hash bcrypt. */
  static async hashSenha(senha: string): Promise<string> {
    return bcrypt.hash(senha, BCRYPT_ROUNDS);
  }
}
