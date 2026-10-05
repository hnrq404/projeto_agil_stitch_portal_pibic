import type { RequestHandler } from 'express';

/**
 * Política de conteúdo da SPA servida pela API: scripts só da própria origem,
 * fontes do Google Fonts e PDFs exibidos via blob URL (PdfViewer).
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "frame-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Headers de segurança básicos (subconjunto do que o helmet aplica), sem dependência extra. */
export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  };
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  /** Conta só as respostas 401 (ex.: login errado), sem punir quem acerta a senha. */
  onlyFailures?: boolean;
  now?: () => number;
}

interface Janela {
  count: number;
  resetAt: number;
}

/**
 * Limite de requisições por IP em janela fixa, guardado em memória.
 * Suficiente para uma instância única; com várias instâncias, mover para Redis.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now;
  const janelas = new Map<string, Janela>();

  function limparExpiradas(agora: number): void {
    for (const [key, janela] of janelas) {
      if (janela.resetAt <= agora) janelas.delete(key);
    }
  }

  return (req, res, next) => {
    const agora = now();
    if (janelas.size > 1000) limparExpiradas(agora);

    const key = req.ip ?? 'desconhecido';
    let janela = janelas.get(key);
    if (!janela || janela.resetAt <= agora) {
      janela = { count: 0, resetAt: agora + options.windowMs };
      janelas.set(key, janela);
    }

    if (janela.count >= options.max) {
      res.setHeader('Retry-After', String(Math.ceil((janela.resetAt - agora) / 1000)));
      res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: options.message } });
      return;
    }

    const atual = janela;
    if (options.onlyFailures) {
      res.on('finish', () => {
        if (res.statusCode === 401) atual.count += 1;
      });
    } else {
      atual.count += 1;
    }
    next();
  };
}
