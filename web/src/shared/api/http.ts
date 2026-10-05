import type { ApiErrorBody } from '@/shared/types/api';

/**
 * Cliente HTTP da SPA: anexa o JWT, normaliza erros da API em ApiError e
 * avisa a aplicação quando a sessão expira (RN12), via evento global.
 */

const TOKEN_KEY = 'portal-pibic.token';
export const SESSION_EXPIRED_EVENT = 'portal-pibic:session-expired';

/** localStorage pode lançar (modo privado, bloqueio de cookies): nunca deixa a app quebrar. */
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // sem persistência: a sessão dura até recarregar a página
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // nada a limpar
    }
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Lista de pendências devolvida pelo backend (ex.: submissão de inscrição). */
  get pendencias(): string[] {
    const details = this.details as { pendencias?: unknown } | undefined;
    return Array.isArray(details?.pendencias) ? (details.pendencias as string[]) : [];
  }
}

/** Mensagem amigável para qualquer erro (rede, API ou bug). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  if (error instanceof Error) return error.message;
  return 'Algo deu errado. Tente novamente.';
}

function authHeaders(): Record<string, string> {
  const token = tokenStorage.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(status: number): void {
  // 401 com sessão ativa = token expirado ou conta removida.
  if (status === 401 && tokenStorage.get()) {
    tokenStorage.clear();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export async function parseApiError(res: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = `Erro ${res.status}`;
  let details: unknown;
  try {
    const body = (await res.json()) as ApiErrorBody;
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
    details = body.error?.details;
  } catch {
    // corpo não-JSON: mantém as mensagens padrão
  }
  return new ApiError(res.status, code, message, details);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...authHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw await parseApiError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

function withBody(method: string, body?: unknown): RequestInit {
  return { method, body: body === undefined ? undefined : JSON.stringify(body) };
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, withBody('POST', body)),
  patch: <T>(path: string, body?: unknown) => request<T>(path, withBody('PATCH', body)),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * Upload de PDF com progresso real (fetch não expõe progresso de envio).
 * O corpo vai cru (application/pdf) e o nome original no header X-Filename.
 */
export function uploadPdf<T>(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', path);
    for (const [key, value] of Object.entries(authHeaders())) xhr.setRequestHeader(key, value);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new TypeError('Falha de rede no envio do arquivo.'));
    xhr.onload = () => {
      // Um proxy pode responder HTML (413/502); sem o try, o parse lançaria e a Promise nunca terminaria.
      let body: unknown;
      try {
        body = xhr.responseText ? (JSON.parse(xhr.responseText) as unknown) : undefined;
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }
      handleUnauthorized(xhr.status);
      const err = (body as ApiErrorBody | undefined)?.error;
      const fallback = xhr.status === 413 ? 'Arquivo acima do limite de 10 MB.' : `Erro ${xhr.status}`;
      reject(new ApiError(xhr.status, err?.code ?? 'HTTP_ERROR', err?.message ?? fallback, err?.details));
    };
    xhr.send(file);
  });
}

/** Baixa um arquivo protegido (PDF/CSV) com o token e devolve o Blob. */
export async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw await parseApiError(res);
  }
  return res.blob();
}

/** Dispara o "Salvar como" do navegador para um Blob. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
