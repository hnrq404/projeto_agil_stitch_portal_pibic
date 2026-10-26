import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { ForbiddenError, NotFoundError, ValidationError } from '../errors/domain.errors';

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
 * Como o navegador envia o PDF. O arquivo nunca passa pela API em produção
 * (a Vercel limita o corpo das funções a 4,5 MB):
 * - `vercel-blob`: o front usa `put()` do @vercel/blob/client com o token de curta duração;
 * - `api`: PUT do PDF cru na URL assinada da própria API (dev local e testes).
 */
export type InstrucaoUpload =
  | { provedor: 'api'; url: string }
  | { provedor: 'vercel-blob'; pathname: string; token: string };

/** O que o servidor confere do arquivo depois do envio, antes de registrá-lo. */
export interface ObjetoEnviado {
  tamanho: number;
  /** Primeiros bytes, para conferir a assinatura `%PDF-`. */
  inicio: Buffer;
}

/**
 * Porta de armazenamento de arquivos (hexagonal): Vercel Blob em produção,
 * disco no dev local e memória nos testes.
 */
export interface ArquivoStorage {
  /** Autoriza o envio de um arquivo para esta chave (válido por poucos minutos). */
  prepararUpload(chave: string): Promise<InstrucaoUpload>;
  /** Metadados do arquivo enviado, ou undefined se nada chegou nessa chave. */
  inspecionar(chave: string): Promise<ObjetoEnviado | undefined>;
  /** URL temporária para o navegador abrir o PDF (a permissão já foi conferida pela API). */
  urlDeLeitura(chave: string, nome: string): Promise<string>;
  remove(chave: string): Promise<void>;
  /** Gravação feita pelo próprio servidor (seed de demonstração), sem passar pelo navegador. */
  salvar(chave: string, conteudo: Buffer): Promise<void>;
  /** Cópia independente: apagar ou trocar a origem depois não afeta o destino. */
  copiar(origem: string, destino: string): Promise<void>;
}

/**
 * Valida o arquivo recebido: tamanho e assinatura `%PDF-` (não confiamos no
 * Content-Type nem na extensão informados pelo cliente).
 */
export function assertPdfEnviado(objeto: ObjetoEnviado | undefined): asserts objeto is ObjetoEnviado {
  if (!objeto) {
    throw new ValidationError('O arquivo não chegou ao armazenamento. Envie o PDF novamente.');
  }
  if (objeto.tamanho === 0) {
    throw new ValidationError('Arquivo vazio. Selecione um PDF válido.');
  }
  if (objeto.tamanho > MAX_PDF_BYTES) {
    throw new ValidationError(`Arquivo com ${(objeto.tamanho / 1024 / 1024).toFixed(1)} MB. O limite é 10 MB.`);
  }
  if (objeto.inicio.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new ValidationError('Formato inválido. Apenas arquivos PDF são aceitos.');
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

/** Chaves são geradas pelo backend (prefixo do dono + UUID); a regra impede path traversal. */
const CHAVE_VALIDA = /^[A-Za-z0-9_-]{1,200}$/;

export function assertChaveValida(chave: string): void {
  if (!CHAVE_VALIDA.test(chave)) {
    throw new ValidationError('Chave de arquivo inválida.');
  }
}

const VALIDADE_UPLOAD_MS = 15 * 60 * 1000;
const VALIDADE_LEITURA_MS = 5 * 60 * 1000;

/**
 * Base dos armazenamentos locais (disco e memória). Imita o fluxo de produção:
 * a API emite URLs assinadas com HMAC e validade curta, e as rotas
 * /api/arquivos/... (registradas só nesse modo) aceitam o envio e servem a leitura.
 */
export abstract class ArmazenamentoLocal implements ArquivoStorage {
  constructor(
    private readonly segredo: string,
    private readonly agora: () => number = Date.now,
  ) {}

  protected abstract gravar(chave: string, conteudo: Buffer): Promise<void>;
  protected abstract ler(chave: string): Promise<Buffer | undefined>;
  abstract remove(chave: string): Promise<void>;

  async prepararUpload(chave: string): Promise<InstrucaoUpload> {
    assertChaveValida(chave);
    const exp = this.agora() + VALIDADE_UPLOAD_MS;
    const sig = this.assinar(`upload:${chave}:${exp}`);
    return { provedor: 'api', url: `/api/arquivos/envio/${chave}?exp=${exp}&sig=${sig}` };
  }

  async inspecionar(chave: string): Promise<ObjetoEnviado | undefined> {
    assertChaveValida(chave);
    const conteudo = await this.ler(chave);
    return conteudo ? { tamanho: conteudo.length, inicio: conteudo.subarray(0, 8) } : undefined;
  }

  async salvar(chave: string, conteudo: Buffer): Promise<void> {
    assertChaveValida(chave);
    await this.gravar(chave, conteudo);
  }

  async copiar(origem: string, destino: string): Promise<void> {
    assertChaveValida(origem);
    assertChaveValida(destino);
    const conteudo = await this.ler(origem);
    if (!conteudo) throw new NotFoundError('Arquivo de origem não encontrado.');
    await this.gravar(destino, conteudo);
  }

  async urlDeLeitura(chave: string, nome: string): Promise<string> {
    assertChaveValida(chave);
    const exp = this.agora() + VALIDADE_LEITURA_MS;
    const sig = this.assinar(`leitura:${chave}:${exp}:${nome}`);
    return `/api/arquivos/${chave}?exp=${exp}&nome=${encodeURIComponent(nome)}&sig=${sig}`;
  }

  /** Rota PUT /api/arquivos/envio/:chave. */
  async receberUpload(chave: string, exp: string, sig: string, conteudo: Buffer): Promise<void> {
    assertChaveValida(chave);
    this.verificar(`upload:${chave}:${exp}`, exp, sig);
    if (conteudo.length > MAX_PDF_BYTES) {
      throw new ValidationError('Arquivo acima do limite de 10 MB.');
    }
    await this.gravar(chave, conteudo);
  }

  /** Rota GET /api/arquivos/:chave. */
  async lerAssinado(chave: string, exp: string, nome: string, sig: string): Promise<Buffer> {
    assertChaveValida(chave);
    this.verificar(`leitura:${chave}:${exp}:${nome}`, exp, sig);
    const conteudo = await this.ler(chave);
    if (!conteudo) throw new NotFoundError('Arquivo não encontrado.');
    return conteudo;
  }

  private assinar(mensagem: string): string {
    return createHmac('sha256', this.segredo).update(mensagem).digest('base64url');
  }

  private verificar(mensagem: string, exp: string, sig: string): void {
    const esperado = Buffer.from(this.assinar(mensagem));
    const recebido = Buffer.from(sig);
    const valida = esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
    if (!valida || !(Number(exp) > this.agora())) {
      throw new ForbiddenError('Link de arquivo inválido ou expirado. Tente de novo pela página.');
    }
  }
}

export class InMemoryArquivoStorage extends ArmazenamentoLocal {
  private readonly files = new Map<string, Buffer>();

  constructor(segredo = 'segredo-de-teste', agora?: () => number) {
    super(segredo, agora);
  }

  protected async gravar(chave: string, conteudo: Buffer): Promise<void> {
    this.files.set(chave, Buffer.from(conteudo));
  }

  protected async ler(chave: string): Promise<Buffer | undefined> {
    const found = this.files.get(chave);
    return found ? Buffer.from(found) : undefined;
  }

  async remove(chave: string): Promise<void> {
    this.files.delete(chave);
  }
}

/** Grava os arquivos em um diretório local (server/uploads, ignorado pelo git). */
export class DiskArquivoStorage extends ArmazenamentoLocal {
  constructor(
    private readonly baseDir: string,
    segredo: string,
  ) {
    super(segredo);
  }

  protected async gravar(chave: string, conteudo: Buffer): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(path.join(this.baseDir, chave), conteudo);
  }

  protected async ler(chave: string): Promise<Buffer | undefined> {
    try {
      return await fs.readFile(path.join(this.baseDir, chave));
    } catch {
      return undefined;
    }
  }

  async remove(chave: string): Promise<void> {
    assertChaveValida(chave);
    await fs.rm(path.join(this.baseDir, chave), { force: true });
  }
}
