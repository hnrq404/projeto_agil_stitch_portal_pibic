import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Identificador da requisição: liga a linha de log, o erro e o relato do usuário. */
      requestId?: string;
    }
  }
}

/** Aceita o X-Request-Id de um proxy só se tiver formato seguro para ir ao log. */
const REQUEST_ID_VALIDO = /^[\w-]{1,64}$/;

/** Gera (ou reaproveita) o id da requisição e devolve no header X-Request-Id. */
export function requestContext(): RequestHandler {
  return (req, res, next) => {
    const recebido = req.headers['x-request-id'];
    req.requestId = typeof recebido === 'string' && REQUEST_ID_VALIDO.test(recebido) ? recebido : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  };
}

/**
 * Uma linha JSON por requisição da API (método, rota, status, duração, usuário).
 * Só o caminho vai para o log, sem query string nem corpo, para não gravar dados pessoais.
 */
export function requestLogger(): RequestHandler {
  return (req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      next();
      return;
    }
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const linha = {
        nivel: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        ts: new Date().toISOString(),
        requestId: req.requestId,
        metodo: req.method,
        rota: req.baseUrl + req.path,
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
        usuarioId: req.user?.id,
      };
      (res.statusCode >= 500 ? console.error : console.log)(JSON.stringify(linha));
    });
    next();
  };
}
