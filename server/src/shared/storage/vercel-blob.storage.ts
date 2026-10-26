import { BlobNotFoundError, copy, del, get, head, issueSignedToken, presignUrl, put } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

import {
  assertChaveValida,
  MAX_PDF_BYTES,
  type ArquivoStorage,
  type InstrucaoUpload,
  type ObjetoEnviado,
} from './arquivo.storage';

const VALIDADE_UPLOAD_MS = 15 * 60 * 1000;
const VALIDADE_LEITURA_MS = 5 * 60 * 1000;

/**
 * Armazenamento em produção: Vercel Blob com acesso PRIVADO. O navegador envia
 * o PDF direto ao Blob com um token restrito a um caminho, a PDF e a 10 MB; a
 * leitura usa URL pré-assinada que expira em minutos, emitida só depois de a
 * API conferir quem pode ver o arquivo.
 */
export class VercelBlobStorage implements ArquivoStorage {
  constructor(private readonly token: string) {}

  private pathname(chave: string): string {
    assertChaveValida(chave);
    return `pdfs/${chave}.pdf`;
  }

  async prepararUpload(chave: string): Promise<InstrucaoUpload> {
    const pathname = this.pathname(chave);
    const token = await generateClientTokenFromReadWriteToken({
      token: this.token,
      pathname,
      allowedContentTypes: ['application/pdf'],
      maximumSizeInBytes: MAX_PDF_BYTES,
      validUntil: Date.now() + VALIDADE_UPLOAD_MS,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return { provedor: 'vercel-blob', pathname, token };
  }

  async inspecionar(chave: string): Promise<ObjetoEnviado | undefined> {
    const pathname = this.pathname(chave);
    let tamanho: number;
    try {
      tamanho = (await head(pathname, { token: this.token })).size;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return undefined;
      throw error;
    }
    // Só os primeiros bytes, para conferir a assinatura %PDF- sem baixar o arquivo todo.
    const resposta = await get(pathname, {
      access: 'private',
      token: this.token,
      useCache: false,
      headers: { Range: 'bytes=0-7' },
    });
    if (!resposta || resposta.statusCode !== 200) return { tamanho, inicio: Buffer.alloc(0) };
    const leitor = resposta.stream.getReader();
    const { value } = await leitor.read();
    await leitor.cancel();
    return { tamanho, inicio: Buffer.from(value ?? new Uint8Array()).subarray(0, 8) };
  }

  async urlDeLeitura(chave: string): Promise<string> {
    const pathname = this.pathname(chave);
    const validUntil = Date.now() + VALIDADE_LEITURA_MS;
    const assinatura = await issueSignedToken({ token: this.token, pathname, operations: ['get'], validUntil });
    const { presignedUrl } = await presignUrl(assinatura, { operation: 'get', pathname, access: 'private', validUntil });
    return presignedUrl;
  }

  async salvar(chave: string, conteudo: Buffer): Promise<void> {
    await put(this.pathname(chave), conteudo, {
      access: 'private',
      token: this.token,
      contentType: 'application/pdf',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }

  async copiar(origem: string, destino: string): Promise<void> {
    await copy(this.pathname(origem), this.pathname(destino), {
      access: 'private',
      token: this.token,
      contentType: 'application/pdf',
      addRandomSuffix: false,
    });
  }

  async remove(chave: string): Promise<void> {
    await del(this.pathname(chave), { token: this.token });
  }
}
