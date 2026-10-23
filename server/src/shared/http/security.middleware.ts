import type { RequestHandler } from 'express';

/**
 * Política de conteúdo da SPA: scripts só da própria origem, fontes do Google
 * Fonts, envio de PDF direto ao Vercel Blob (vercel.com/api/blob) e exibição
 * dos PDFs privados por URL pré-assinada (*.blob.vercel-storage.com).
 *
 * A Vercel serve os arquivos estáticos sem passar pelo Express, então a mesma
 * política está repetida em vercel.json; um teste garante que as duas não divergem.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "frame-src 'self' blob: https://*.blob.vercel-storage.com",
  "connect-src 'self' https://vercel.com",
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

export interface JanelaDeTentativas {
  count: number;
  resetAt: number;
}

/**
 * Onde os contadores ficam. Em memória basta para um processo só; na Vercel,
 * cada requisição pode cair numa instância diferente, então o contador vai
 * para o Firestore (infra/firestore/firestore.rate-limit.store.ts).
 */
export interface RateLimitStore {
  consultar(chave: string, agora: number): Promise<JanelaDeTentativas>;
  incrementar(chave: string, agora: number, windowMs: number): Promise<JanelaDeTentativas>;
}

export function createMemoryRateLimitStore(): RateLimitStore {
  const janelas = new Map<string, JanelaDeTentativas>();
  return {
    async consultar(chave, agora) {
      const janela = janelas.get(chave);
      return janela && janela.resetAt > agora ? { ...janela } : { count: 0, resetAt: agora };
    },
    async incrementar(chave, agora, windowMs) {
      if (janelas.size > 1000) {
        for (const [k, j] of janelas) if (j.resetAt <= agora) janelas.delete(k);
      }
      const atual = janelas.get(chave);
      const janela =
        atual && atual.resetAt > agora
          ? { count: atual.count + 1, resetAt: atual.resetAt }
          : { count: 1, resetAt: agora + windowMs };
      janelas.set(chave, janela);
      return { ...janela };
    },
  };
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  /** Conta só as respostas 401 (ex.: login errado), sem punir quem acerta a senha. */
  onlyFailures?: boolean;
  /** Padrão: em memória. */
  store?: RateLimitStore;
  /** Separa os contadores de rotas diferentes no mesmo store. */
  prefixo?: string;
  now?: () => number;
}

/**
 * Limite de requisições por IP em janela fixa. Se o store falhar, a requisição
 * segue (fail-open): uma pane no contador não pode impedir todo mundo de entrar.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now;
  const store = options.store ?? createMemoryRateLimitStore();

  return (req, res, next) => {
    const chave = `${options.prefixo ?? 'geral'}:${req.ip ?? 'desconhecido'}`;
    const agora = now();

    store
      .consultar(chave, agora)
      .then(async (janela) => {
        if (janela.count >= options.max) {
          res.setHeader('Retry-After', String(Math.max(1, Math.ceil((janela.resetAt - agora) / 1000))));
          res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: options.message } });
          return;
        }
        if (!options.onlyFailures) {
          await store.incrementar(chave, agora, options.windowMs);
          next();
          return;
        }
        // Conta o 401 ANTES de a resposta sair: numa função serverless, o que
        // roda depois do envio pode ser congelado e nunca terminar.
        const endOriginal = res.end.bind(res) as (...args: unknown[]) => typeof res;
        res.end = ((...args: unknown[]) => {
          if (res.statusCode !== 401) return endOriginal(...args);
          store
            .incrementar(chave, now(), options.windowMs)
            .catch((error: unknown) => console.error('[rate-limit] Falha ao contar tentativa', error))
            .finally(() => endOriginal(...args));
          return res;
        }) as typeof res.end;
        next();
      })
      .catch((error: unknown) => {
        console.error('[rate-limit] Contador indisponível; requisição liberada', error);
        next();
      });
  };
}
