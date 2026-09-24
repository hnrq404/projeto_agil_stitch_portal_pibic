import type { ApiError } from '../types';

/** Cliente HTTP da SPA — anexa o JWT e normaliza erros da API. */

const TOKEN_KEY = 'portal-pibic.token';

export function getToken(): string | undefined {
  return localStorage.getItem(TOKEN_KEY) ?? undefined;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class HttpApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (init.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...init, headers });

  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let message = `Erro ${res.status}`;
    let details: unknown;
    try {
      const body = (await res.json()) as ApiError;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // corpo não-JSON: mantém mensagens padrão
    }
    throw new HttpApiError(res.status, code, message, details);
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
};
