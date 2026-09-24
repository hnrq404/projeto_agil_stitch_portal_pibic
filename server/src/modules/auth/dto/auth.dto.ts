import { z } from 'zod';

import type { AuthResult, PublicUsuario } from '../domain/auth.types';

export const registerSchema = z
  .object({
    nome: z.string().trim().min(3, 'nome deve ter ao menos 3 caracteres'),
    email: z.string().trim().toLowerCase().email('e-mail inválido'),
    senha: z.string().min(6, 'senha deve ter ao menos 6 caracteres'),
    role: z.enum(['GESTOR', 'USUARIO']),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('e-mail inválido'),
    senha: z.string().min(1, 'senha é obrigatória'),
  })
  .strict();

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;

export function toAuthResponse(result: AuthResult) {
  return {
    token: result.token,
    usuario: result.usuario,
  };
}

export type AuthResponse = ReturnType<typeof toAuthResponse>;
export type { PublicUsuario };
