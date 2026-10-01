import fs from 'node:fs/promises';
import path from 'node:path';

import { NotFoundError, ValidationError } from '../errors/domain.errors';

/** RN06/RNF09 — apenas PDF, até 10 MB. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Metadados de um arquivo enviado. O conteúdo vive no storage, referenciado por `storageKey`. */
export interface ArquivoRef {
  storageKey: string;
  nome: string;
  tamanho: number;
  mimeType: 'application/pdf';
}

/**
 * Porta de armazenamento de arquivos (hexagonal). Em produção grava em disco;
 * nos testes, em memória. Trocar por S3/MinIO = nova implementação desta porta.
 */
export interface ArquivoStorage {
  save(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

/**
 * Valida o upload antes de qualquer gravação: tamanho, assinatura `%PDF-` (não
 * confiamos só na extensão ou no Content-Type enviados pelo cliente) e nome.
 */
export function assertPdfValido(content: Buffer, nome: string): void {
  if (content.length === 0) {
    throw new ValidationError('Arquivo vazio. Selecione um PDF válido.');
  }
  if (content.length > MAX_PDF_BYTES) {
    throw new ValidationError(
      `Arquivo com ${(content.length / 1024 / 1024).toFixed(1)} MB. O limite é 10 MB.`,
    );
  }
  if (content.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new ValidationError('Formato inválido. Apenas arquivos PDF são aceitos.');
  }
  if (!nome.trim()) {
    throw new ValidationError('Nome do arquivo é obrigatório.');
  }
}

/** Remove caminhos e caracteres de controle do nome enviado pelo cliente. */
export function sanitizeNomeArquivo(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const limpo = base.replace(/[\u0000-\u001f"<>|:*?]/g, '').trim();
  const nome = limpo.slice(0, 120) || 'documento.pdf';
  return nome.toLowerCase().endsWith('.pdf') ? nome : `${nome}.pdf`;
}

export class InMemoryArquivoStorage implements ArquivoStorage {
  private readonly files = new Map<string, Buffer>();

  async save(key: string, content: Buffer): Promise<void> {
    this.files.set(key, Buffer.from(content));
  }

  async read(key: string): Promise<Buffer> {
    const found = this.files.get(key);
    if (!found) throw new NotFoundError('Arquivo não encontrado.');
    return Buffer.from(found);
  }

  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }
}

/** Grava os arquivos em um diretório local (server/uploads, ignorado pelo git). */
export class DiskArquivoStorage implements ArquivoStorage {
  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    // As chaves são UUIDs gerados pelo backend; a checagem evita path traversal.
    if (!/^[a-zA-Z0-9-]+$/.test(key)) {
      throw new ValidationError('Chave de arquivo inválida.');
    }
    return path.join(this.baseDir, key);
  }

  async save(key: string, content: Buffer): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.resolve(key), content);
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      throw new NotFoundError('Arquivo não encontrado.');
    }
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}
