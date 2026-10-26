import { z } from 'zod';

import { USER_ROLES } from '@shared/auth/auth.types';

import { REGISTRO_ROLES, type AuthResult, type PublicUsuario } from '../domain/auth.types';

// Mínimo de 8 com letra e número; máximo de 72 bytes porque o bcrypt ignora o que passa disso.
const senhaForte = z
  .string()
  .min(8, 'senha deve ter ao menos 8 caracteres')
  .refine((s) => Buffer.byteLength(s, 'utf8') <= 72, 'senha deve ter no máximo 72 caracteres')
  .refine((s) => /\p{L}/u.test(s) && /\d/.test(s), 'senha deve combinar letras e números');

/** Só contas institucionais da UNICAP se cadastram (inclusive visitantes). */
export const DOMINIO_INSTITUCIONAL = '@unicap.br';

const emailSchema = z.string().trim().toLowerCase().email('e-mail inválido');

export const registerSchema = z
  .object({
    nome: z.string().trim().min(3, 'nome deve ter ao menos 3 caracteres'),
    email: emailSchema.refine(
      (e) => e.endsWith(DOMINIO_INSTITUCIONAL),
      `use seu e-mail institucional ${DOMINIO_INSTITUCIONAL}`,
    ),
    senha: senhaForte,
    role: z.enum(REGISTRO_ROLES),
    departamento: z.string().trim().max(60).optional(),
    matricula: z.string().trim().max(30).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    senha: z.string().min(1, 'senha é obrigatória'),
  })
  .strict();

/** Link clicado no e-mail (confirmação de conta). */
export const tokenSchema = z.object({ token: z.string().trim().min(10).max(500) }).strict();

/** Pedido de novo link (confirmação ou senha): só o e-mail. */
export const emailPedidoSchema = z.object({ email: emailSchema }).strict();

/** Nova senha pelo link do e-mail. */
export const redefinirSenhaSchema = z
  .object({ token: z.string().trim().min(10).max(500), novaSenha: senhaForte })
  .strict();

/** Currículo enviado logo após o cadastro, antes de a conta ter sessão. */
export const curriculoCadastroSchema = z
  .object({
    usuarioId: z.string().trim().min(1).max(64),
    chave: z.string().trim().min(1).max(200),
    nome: z.string().trim().min(1).max(255),
  })
  .strict();

/** Troca de senha pelo próprio usuário logado. */
export const alterarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'informe a senha atual'),
    novaSenha: senhaForte,
  })
  .strict();

/** Atualização de perfil feita pelo gestor (S1.2). */
export const updateUsuarioSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    departamento: z.string().trim().max(60).optional(),
  })
  .strict()
  .refine((data) => data.role !== undefined || data.departamento !== undefined, {
    message: 'Informe ao menos um campo para atualizar (role ou departamento).',
  });

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type AlterarSenhaDto = z.infer<typeof alterarSenhaSchema>;
export type UpdateUsuarioDto = z.infer<typeof updateUsuarioSchema>;

export function toAuthResponse(result: AuthResult) {
  return {
    token: result.token,
    usuario: result.usuario,
  };
}

export type AuthResponse = ReturnType<typeof toAuthResponse>;
export type { PublicUsuario };
