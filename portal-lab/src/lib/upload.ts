import { validarAnexo } from "../../convex/inscricoes/regras";

/**
 * Upload direto ao Convex Storage via XHR para expor progresso (S3.2).
 * Fluxo: URL de upload (mutation) → POST binário → registrarAnexo (mutation).
 */
export type UploadPdfArgs = {
  file: File;
  gerarUploadUrl: () => Promise<string>;
  registrarAnexo: (args: {
    inscricaoId: string;
    storageId: string;
    nome: string;
    mimeType: string;
    tamanho: number;
    tipo: "plano_trabalho" | "lattes";
  }) => Promise<{ arquivoId: string }>;
  inscricaoId: string;
  tipo: "plano_trabalho" | "lattes";
  onProgress: (porcentagem: number) => void;
};

export type UploadResultado =
  | { ok: true; arquivoId: string }
  | { ok: false; erro: string };

/** Validação imediata no cliente (RN06/RNF09) espelha o backend. */
export function validarArquivoPdf(file: File): string | null {
  return validarAnexo({ nome: file.name, mimeType: file.type, tamanho: file.size });
}

export async function uploadPdfComProgresso(args: UploadPdfArgs): Promise<UploadResultado> {
  const erroValidacao = validarArquivoPdf(args.file);
  if (erroValidacao) {
    return { ok: false, erro: erroValidacao };
  }
  try {
    const url = await args.gerarUploadUrl();
    const storageId = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", args.file.type || "application/pdf");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          args.onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText) as { storageId: string };
            resolve(json.storageId);
          } catch {
            reject(new Error("Resposta inválida do storage."));
          }
        } else {
          reject(new Error(`Falha no upload (HTTP ${xhr.status}).`));
        }
      };
      xhr.onerror = () => reject(new Error("Erro de rede durante o upload."));
      xhr.send(args.file);
    });
    const { arquivoId } = await args.registrarAnexo({
      inscricaoId: args.inscricaoId,
      storageId,
      nome: args.file.name,
      mimeType: args.file.type || "application/pdf",
      tamanho: args.file.size,
      tipo: args.tipo,
    });
    args.onProgress(100);
    return { ok: true, arquivoId };
  } catch (err) {
    const data = (err as Error & { data?: { message?: string } }).data;
    return { ok: false, erro: data?.message ?? (err instanceof Error ? err.message : "Falha no upload.") };
  }
}
