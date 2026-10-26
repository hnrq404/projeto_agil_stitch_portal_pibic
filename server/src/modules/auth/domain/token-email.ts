import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { ValidationError } from '@shared/errors/domain.errors';

import type { TokenEmail } from './auth.types';

/** Confirmação de e-mail: tempo para a pessoa abrir a caixa de entrada sem pressa. */
export const VALIDADE_VERIFICACAO_MS = 48 * 60 * 60 * 1000;
/** Redefinição de senha: curta, porque quem tiver o link troca a senha. */
export const VALIDADE_SENHA_MS = 60 * 60 * 1000;

const LINK_INVALIDO = 'Link inválido ou expirado. Peça um novo na tela de entrada.';

function hash(segredo: string): string {
  return createHash('sha256').update(segredo).digest('hex');
}

/**
 * Gera o token do link ("<usuarioId>.<segredo>"). O id permite achar a conta
 * sem consulta; do segredo, só o hash é gravado, então nem quem lê o banco
 * consegue montar um link válido.
 */
export function gerarTokenEmail(usuarioId: string, validadeMs: number, agora: Date): { token: string; registro: TokenEmail } {
  const segredo = randomBytes(32).toString('base64url');
  return {
    token: `${usuarioId}.${segredo}`,
    registro: { hash: hash(segredo), expiraEm: new Date(agora.getTime() + validadeMs) },
  };
}

export function lerTokenEmail(token: string): { usuarioId: string; segredo: string } {
  const separador = token.lastIndexOf('.');
  if (separador <= 0 || separador === token.length - 1) throw new ValidationError(LINK_INVALIDO);
  return { usuarioId: token.slice(0, separador), segredo: token.slice(separador + 1) };
}

/** Confere o segredo contra o registro gravado e a validade. */
export function assertTokenValido(registro: TokenEmail | null | undefined, segredo: string, agora: Date): void {
  if (!registro || registro.expiraEm.getTime() <= agora.getTime()) {
    throw new ValidationError(LINK_INVALIDO);
  }
  const esperado = Buffer.from(registro.hash, 'hex');
  const recebido = Buffer.from(hash(segredo), 'hex');
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    throw new ValidationError(LINK_INVALIDO);
  }
}
