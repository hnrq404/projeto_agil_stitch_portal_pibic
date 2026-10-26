import type { NextFunction, Request, Response, Router } from 'express';

import { asyncHandler, parseBody } from '@shared/http/http.middleware';
import { UnauthorizedError } from '@shared/auth/auth.types';

import type { AuthService } from './auth.service';
import {
  alterarSenhaSchema,
  curriculoCadastroSchema,
  emailPedidoSchema,
  loginSchema,
  redefinirSenhaSchema,
  registerSchema,
  tokenSchema,
  toAuthResponse,
} from './dto/auth.dto';
import type { PerfilService } from './perfil.service';

/**
 * Rotas de autenticação:
 *   POST /api/auth/register               → cria a conta pendente e envia o link de confirmação
 *                                            (aluno: também devolve a autorização para enviar o Lattes)
 *   PUT  /api/auth/cadastro/curriculo     → { usuarioId, chave, nome }: Lattes enviado logo após o cadastro
 *   POST /api/auth/verificar-email        → { token }: confirma o e-mail e já devolve o JWT
 *   POST /api/auth/reenviar-verificacao   → { email }: novo link de confirmação
 *   POST /api/auth/login                  → JWT (403 EMAIL_NAO_CONFIRMADO se a conta não foi confirmada)
 *   POST /api/auth/esqueci-senha          → { email }: link de redefinição
 *   POST /api/auth/redefinir-senha        → { token, novaSenha }: troca a senha e devolve o JWT
 *   GET  /api/auth/me                     → perfil do portador do JWT (bootstrap da SPA)
 *   POST /api/auth/senha                  → troca a senha logado; derruba as outras sessões e devolve um JWT novo
 */
export function registerAuthRoutes(
  router: Router,
  service: AuthService,
  perfil: PerfilService,
  authenticationGuard: (req: Request, res: Response, next: NextFunction) => void,
): void {
  router.post(
    '/api/auth/register',
    asyncHandler(async (req, res) => {
      const dto = parseBody(registerSchema, req.body);
      const { usuario, emailEnviado } = await service.register(dto);
      res.status(201).json({
        pendente: true,
        usuarioId: usuario.id,
        email: usuario.email,
        emailEnviado,
        envioCurriculo: usuario.role === 'DISCENTE' ? await perfil.prepararCurriculoDoCadastro(usuario) : null,
      });
    }),
  );

  router.put(
    '/api/auth/cadastro/curriculo',
    asyncHandler(async (req, res) => {
      const dto = parseBody(curriculoCadastroSchema, req.body);
      await perfil.confirmarCurriculoDoCadastro(dto.usuarioId, dto.chave, dto.nome);
      res.status(204).end();
    }),
  );

  router.post(
    '/api/auth/verificar-email',
    asyncHandler(async (req, res) => {
      const dto = parseBody(tokenSchema, req.body);
      res.json(toAuthResponse(await service.verificarEmail(dto.token)));
    }),
  );

  router.post(
    '/api/auth/reenviar-verificacao',
    asyncHandler(async (req, res) => {
      const dto = parseBody(emailPedidoSchema, req.body);
      await service.reenviarVerificacao(dto.email);
      // Mesma resposta para qualquer e-mail: não revela quais têm conta.
      res.status(202).json({ mensagem: 'Se houver uma conta aguardando confirmação, um novo link foi enviado.' });
    }),
  );

  router.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const dto = parseBody(loginSchema, req.body);
      res.json(toAuthResponse(await service.login(dto)));
    }),
  );

  router.post(
    '/api/auth/esqueci-senha',
    asyncHandler(async (req, res) => {
      const dto = parseBody(emailPedidoSchema, req.body);
      await service.esqueciSenha(dto.email);
      res.status(202).json({ mensagem: 'Se houver uma conta com este e-mail, enviamos o link para criar uma nova senha.' });
    }),
  );

  router.post(
    '/api/auth/redefinir-senha',
    asyncHandler(async (req, res) => {
      const dto = parseBody(redefinirSenhaSchema, req.body);
      res.json(toAuthResponse(await service.redefinirSenha(dto.token, dto.novaSenha)));
    }),
  );

  router.post(
    '/api/auth/senha',
    authenticationGuard,
    asyncHandler(async (req, res) => {
      const dto = parseBody(alterarSenhaSchema, req.body);
      res.json(toAuthResponse(await service.alterarSenha(req.user!.id, dto)));
    }),
  );

  router.get(
    '/api/auth/me',
    asyncHandler(async (req, res, next) => {
      try {
        const header = req.headers.authorization;
        if (!header) {
          throw new UnauthorizedError();
        }
        const token = header.replace(/^Bearer\s+/i, '').trim();
        const usuario = await service.resolveToken(token);
        res.json({ usuario });
      } catch (error) {
        next(error);
      }
    }),
  );
}

