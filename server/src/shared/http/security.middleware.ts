import type { Request, RequestHandler } from 'express';

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
  consultar(chave: string, agora: number, windowMs: number): Promise<JanelaDeTentativas>;
  /** Soma uma tentativa de forma atômica e devolve a janela já com ela. */
  incrementar(chave: string, agora: number, windowMs: number): Promise<JanelaDeTentativas>;
  /** Devolve uma tentativa reservada que acabou não contando (ex.: a senha estava certa). */
  decrementar(chave: string, agora: number, windowMs: number): Promise<void>;
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
    async decrementar(chave, agora) {
      const atual = janelas.get(chave);
      if (atual && atual.resetAt > agora && atual.count > 0) janelas.set(chave, { ...atual, count: atual.count - 1 });
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
  /**
   * Parte da chave além do IP (ex.: o e-mail informado). Sem ela, todo mundo
   * atrás do mesmo IP (Wi-Fi do campus, NAT) divide um contador só.
   */
  identificador?: (req: Request) => string | undefined;
  /** A chave é só o identificador, sem o IP: o limite vale de qualquer rede. */
  semIp?: boolean;
  /**
   * Padrão (true): a tentativa é reservada ANTES de a rota rodar (soma atômica) e
   * recusada se passar do máximo, então uma rajada simultânea não escapa do limite;
   * com `onlyFailures`, a reserva é devolvida quando a resposta não é 401.
   *
   * false (só com `onlyFailures`): consulta antes e soma só as falhas depois. Nenhuma
   * escrita quando dá certo, para contadores muito disputados (o do IP do campus,
   * que todo login tocaria), ao custo de uma rajada simultânea passar um pouco do máximo.
   */
  reservar?: boolean;
  now?: () => number;
}

/**
 * Limite de tentativas em janela fixa (ver `reservar`).
 *
 * Se o store falhar, a requisição segue (fail-open): uma pane no contador não
 * pode impedir todo mundo de entrar.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now;
  const store = options.store ?? createMemoryRateLimitStore();
  const { windowMs, max } = options;
  const reservar = options.reservar ?? true;

  return (req, res, next) => {
    const id = options.identificador?.(req) ?? '';
    const partes = options.semIp ? [id] : [req.ip ?? 'desconhecido', id];
    const chave = `${options.prefixo ?? 'geral'}:${partes.join(':')}`;
    const agora = now();

    function bloquear(janela: JanelaDeTentativas): void {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((janela.resetAt - agora) / 1000))));
      res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: options.message } });
    }

    // Age ANTES de a resposta sair: numa função serverless, o que roda depois do
    // envio pode ser congelado e nunca terminar.
    function aoResponder(acao: (falhou: boolean) => Promise<void> | undefined): void {
      const endOriginal = res.end.bind(res) as (...args: unknown[]) => typeof res;
      res.end = ((...args: unknown[]) => {
        const pendente = acao(res.statusCode === 401);
        if (!pendente) return endOriginal(...args);
        pendente
          .catch((error: unknown) => console.error('[rate-limit] Falha ao atualizar o contador', error))
          .finally(() => endOriginal(...args));
        return res;
      }) as typeof res.end;
    }

    const passo = reservar
      ? store.incrementar(chave, agora, windowMs).then(async (janela) => {
          if (janela.count > max) {
            // A recusada não testou nada: devolve a reserva para o contador refletir só
            // as tentativas em andamento e as falhas.
            await store.decrementar(chave, agora, windowMs);
            return bloquear(janela);
          }
          if (options.onlyFailures) {
            aoResponder((falhou) => (falhou ? undefined : store.decrementar(chave, agora, windowMs)));
          }
          next();
        })
      : store.consultar(chave, agora, windowMs).then((janela) => {
          if (janela.count >= max) return bloquear(janela);
          aoResponder((falhou) => (falhou ? store.incrementar(chave, now(), windowMs).then(() => undefined) : undefined));
          next();
        });

    passo.catch((error: unknown) => {
      console.error('[rate-limit] Contador indisponível; requisição liberada', error);
      next();
    });
  };
}

/** E-mail informado no corpo (normalizado), para limitar por conta e não por rede. */
export function emailDoCorpo(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
