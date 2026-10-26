import type { ApiErrorBody, InstrucaoUpload } from '@/shared/types/api';

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
  put: <T>(path: string, body?: unknown) => request<T>(path, withBody('PUT', body)),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
};


/**
 * Envio de PDF com progresso real, em três passos. O arquivo não passa pela
 * API, porque a Vercel limita o corpo das funções a 4,5 MB:
 * 1. POST {path}/envio: a API confere a permissão e diz para onde enviar;
 * 2. o navegador envia o PDF direto ao Vercel Blob (no dev local, à rota assinada da API);
 * 3. PUT {path} com { chave, nome }: a API confere o arquivo recebido e o registra.
 */
export async function uploadPdf<T>(path: string, file: File, onProgress?: (percent: number) => void): Promise<T> {
  const { chave, upload } = await http.post<{ chave: string; upload: InstrucaoUpload }>(`${path}/envio`);
  await enviarAoArmazenamento(upload, file, onProgress);
  return http.put<T>(path, { chave, nome: file.name });
}

/** Envia o PDF para onde a API autorizou (usado também no cadastro, que ainda não tem sessão). */
export async function enviarAoArmazenamento(
  upload: InstrucaoUpload,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (upload.provedor === 'api') {
    await putComProgresso(upload.url, file, onProgress);
    return;
  }
  // Carregado sob demanda: só quem envia arquivo baixa o cliente do Blob.
  const { put } = await import('@vercel/blob/client');
  try {
    await put(upload.pathname, file, {
      access: 'private',
      token: upload.token,
      contentType: 'application/pdf',
      onUploadProgress: (evento) => onProgress?.(Math.round(evento.percentage)),
    });
  } catch {
    throw new ApiError(
      0,
      'UPLOAD_FALHOU',
      'Não foi possível enviar o arquivo. Confira se é um PDF de até 10 MB e tente de novo.',
    );
  }
}

/** PUT do PDF cru com progresso (fetch não expõe o progresso de envio). */
function putComProgresso(url: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new TypeError('Falha de rede no envio do arquivo.'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // Um proxy pode responder HTML (413/502); sem o try, o parse lançaria e a Promise nunca terminaria.
      let body: unknown;
      try {
        body = xhr.responseText ? (JSON.parse(xhr.responseText) as unknown) : undefined;
      } catch {
        body = undefined;
      }
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
