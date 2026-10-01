import { z } from 'zod';

import { USER_ROLES } from '@shared/auth/auth.types';

import { REGISTRO_ROLES, type AuthResult, type PublicUsuario } from '../domain/auth.types';

export const registerSchema = z
  .object({
    nome: z.string().trim().min(3, 'nome deve ter ao menos 3 caracteres'),
    email: z.string().trim().toLowerCase().email('e-mail inválido'),
    senha: z.string().min(6, 'senha deve ter ao menos 6 caracteres'),
    role: z.enum(REGISTRO_ROLES),
    departamento: z.string().trim().max(60).optional(),
    matricula: z.string().trim().max(30).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('e-mail inválido'),
    senha: z.string().min(1, 'senha é obrigatória'),
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
export type UpdateUsuarioDto = z.infer<typeof updateUsuarioSchema>;

export function toAuthResponse(result: AuthResult) {
  return {
    token: result.token,
    usuario: result.usuario,
  };
}

export type AuthResponse = ReturnType<typeof toAuthResponse>;
export type { PublicUsuario };
