import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

import { DomainError, ValidationError } from '../errors/domain.errors';
import { UnauthorizedError } from '../auth/auth.types';

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Converte qualquer erro lançado pela aplicação em uma resposta HTTP consistente. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ApiErrorPayload>,
  _next: NextFunction,
): void {
  if (error instanceof DomainError) {
    res.status(error.statusCode).json({
      error: { code: error.name, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof UnauthorizedError) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Payload inválido.', details: error.flatten() },
    });
    return;
  }

  console.error('[unhandled-error]', error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno inesperado.' },
  });
}

/** Envolve handlers síncronos/assíncronos garantindo propagação ao errorHandler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Valida o corpo da requisição com um schema Zod, lançando ValidationError tipado. */
export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Corpo da requisição inválido.', result.error.flatten());
  }
  return result.data;
}
