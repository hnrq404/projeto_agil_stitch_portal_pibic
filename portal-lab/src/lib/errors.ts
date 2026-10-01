import { ConvexError } from "convex/values";

/**
 * Nielsen #9 — converte qualquer erro vindo do Convex/Convex Auth em uma
 * mensagem em português simples, sem códigos técnicos, que diz o que
 * aconteceu e o que fazer a seguir.
 */
export function friendlyError(err: unknown, fallback: string): string {
  const raw = extractMessage(err);
  if (!raw) return fallback;

  if (/InvalidAccountId|InvalidSecret|Invalid credentials/i.test(raw)) {
    return "E-mail ou senha incorretos. Confira se digitou o e-mail institucional completo e tente novamente — ou use “Esqueceu sua senha?”.";
  }
  if (/already exists/i.test(raw)) {
    return "Já existe uma conta com este e-mail. Entre pela aba “Entrar” ou recupere sua senha.";
  }
  if (/TooManyFailedAttempts|rate limit/i.test(raw)) {
    return "Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar de novo.";
  }
  if (/Failed to fetch|NetworkError|WebSocket/i.test(raw)) {
    return "Não foi possível falar com o servidor. Verifique sua conexão com a internet e tente novamente.";
  }
  if (/Sessão expirada|UNAUTHENTICATED/i.test(raw)) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  // Mensagens já escritas em pt-BR pelo backend (ConvexError) são exibidas
  // como estão; stack traces e mensagens internas em inglês não.
  if (err instanceof ConvexError || /[ãçéêíóúõ]/i.test(raw)) {
    return stripServerNoise(raw);
  }
  return fallback;
}

function extractMessage(err: unknown): string | null {
  if (err instanceof ConvexError) {
    const data: unknown = err.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  if (err instanceof Error) return err.message;
  return null;
}

/** Remove prefixos como "[CONVEX M(users:setRole)] [Request ID: …] Server Error". */
function stripServerNoise(message: string): string {
  return message
    .split(/\n\s+at /)[0]
    .replace(/\[CONVEX [^\]]*\]\s*/g, "")
    .replace(/\[Request ID: [^\]]*\]\s*/g, "")
    .replace(/^(Server Error|Uncaught ConvexError:)\s*/i, "")
    .replace(/\s+Called by client$/i, "")
    .trim();
}
