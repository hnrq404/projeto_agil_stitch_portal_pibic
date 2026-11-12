import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError, type z, type ZodTypeAny } from 'zod';

import { DomainError, ValidationError } from '../errors/domain.errors';
import { UnauthorizedError } from '../auth/auth.types';

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    /** Só nos erros 500: o usuário informa este código e achamos a linha no log. */
    requestId?: string;
  };
}

/** Converte qualquer erro lançado pela aplicação em uma resposta HTTP consistente. */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response<ApiErrorPayload>,
  next: NextFunction,
): void {
  // A resposta já saiu (ex.: o prazo da requisição estourou antes de a rota falhar):
  // o Express só encerra a conexão.
  if (res.headersSent) {
    next(error);
    return;
  }

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
      error: { code: 'VALIDATION_ERROR', message: 'Payload inválido.', details: detalhesResumidos(error) },
    });
    return;
  }

  // Erros do body-parser (JSON malformado, corpo acima do limite).
  if (isBodyParserError(error)) {
    const tooLarge = error.type === 'entity.too.large';
    // O mesmo erro vem do PDF (limite de 10 MB) e do JSON (1 MB): a mensagem segue o tipo enviado.
    const ehPdf = req.is('application/pdf') === 'application/pdf';
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
        message: !tooLarge
          ? 'Corpo da requisição malformado.'
          : ehPdf
            ? 'Arquivo acima do limite de 10 MB.'
            : 'Dados enviados acima do tamanho permitido.',
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

  console.error('[unhandled-error]', { requestId: req.requestId, rota: req.originalUrl.split('?')[0] }, error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno inesperado.', requestId: req.requestId },
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

/** Prazo padrão de uma requisição: abaixo dos 30 s da função na Vercel (vercel.json). */
export const PRAZO_REQUISICAO_MS = 25_000;
/** Prazo da checagem do banco no /api/health/ready. */
export const PRAZO_READY_MS = 3_000;

/** Rejeita se a promessa não terminar no prazo (ex.: banco fora do ar, cliente tentando reconectar). */
export function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`Prazo de ${ms} ms esgotado`)), ms);
  });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(timer));
}

/**
 * Responde 503 em JSON se a rota não terminar no prazo. Sem isso, com o banco fora
 * do ar a requisição ficava pendurada até a Vercel derrubar a função com uma página
 * de erro dela (teste de estresse, testes-finais/).
 */
export function prazoDaRequisicao(ms: number): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (res.headersSent) return;
      console.error('[prazo] Requisição sem resposta no prazo', { requestId: req.requestId, rota: req.originalUrl.split('?')[0] });
      res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'O serviço demorou demais para responder. Tente de novo em instantes.',
          requestId: req.requestId,
        },
      });
    }, ms);
    timer.unref();
    const limpar = () => clearTimeout(timer);
    res.on('finish', limpar);
    res.on('close', limpar);
    next();
  };
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

/** Problemas de validação devolvidos na resposta: o suficiente para a tela mostrar, sem virar uma resposta de megabytes. */
const MAX_PROBLEMAS = 20;

function detalhesResumidos(error: ZodError) {
  return new ZodError(error.issues.slice(0, MAX_PROBLEMAS)).flatten();
}

/** Valida o corpo da requisição com um schema Zod, lançando ValidationError tipado. */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError('Corpo da requisição inválido.', detalhesResumidos(result.error));
  }
  return result.data;
}
