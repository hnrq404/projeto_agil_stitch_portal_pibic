import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError, type z, type ZodTypeAny } from 'zod';

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

  // Erros do body-parser (JSON malformado, corpo acima do limite).
  if (isBodyParserError(error)) {
    const tooLarge = error.type === 'entity.too.large';
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
        message: tooLarge ? 'Arquivo acima do limite de 10 MB.' : 'Corpo da requisição malformado.',
      },
    });
    return;
  }

  // Erros conhecidos do Prisma (corrida em chave única, registro sumido entre leitura e escrita).
  const prismaCode = prismaErrorCode(error);
  if (prismaCode === 'P2002') {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'O registro já existe ou foi alterado ao mesmo tempo. Tente novamente.' },
    });
    return;
  }
  if (prismaCode === 'P2025') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' } });
    return;
  }

  console.error('[unhandled-error]', error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno inesperado.' },
  });
}

/** Código de um PrismaClientKnownRequestError, sem acoplar a camada HTTP ao @prisma/client. */
function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'PrismaClientKnownRequestError' && typeof code === 'string' ? code : undefined;
}

function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { type?: unknown }).type === 'string' &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

/** Envolve handlers síncronos/assíncronos garantindo propagação ao errorHandler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Corpo binário de upload de PDF. O limite fica acima de 10 MB para a regra de domínio responder com a mensagem amigável. */
export const pdfBodyParser = express.raw({ type: 'application/pdf', limit: '11mb' });

/** Lê o nome original do arquivo do header `X-Filename` (enviado com encodeURIComponent). */
export function readUploadFilename(req: Request): string {
  const raw = req.headers['x-filename'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Corpo binário do upload (express.raw). Vazio quando o Content-Type não casou. */
export function readUploadBody(req: Request): Buffer {
  return Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
}

/** Envia um PDF inline (pré-visualização no navegador) com nome seguro. */
export function sendPdf(res: Response, content: Buffer, nome: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(content.length));
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(nome)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(content);
}

/** Valida o corpo da requisição com um schema Zod, lançando ValidationError tipado. */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Corpo da requisição inválido.', result.error.flatten());
  }
  return result.data;
}
