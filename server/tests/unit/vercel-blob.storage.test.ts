/**
 * Adaptador do Vercel Blob com o SDK simulado: confere as restrições pedidas ao
 * Blob (privado, só PDF, até 10 MB, sem sobrescrever) sem precisar de conta.
 */
import { ReadableStream } from 'node:stream/web';

import { BlobNotFoundError, get, head, issueSignedToken, presignUrl } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

import { MAX_PDF_BYTES } from '../../src/shared/storage/arquivo.storage';
import { VercelBlobStorage } from '../../src/shared/storage/vercel-blob.storage';

jest.mock('@vercel/blob', () => {
  class BlobNotFoundError extends Error {}
  return {
    BlobNotFoundError,
    del: jest.fn(),
    get: jest.fn(),
    head: jest.fn(),
    issueSignedToken: jest.fn(),
    presignUrl: jest.fn(),
    put: jest.fn(),
  };
});
jest.mock('@vercel/blob/client', () => ({ generateClientTokenFromReadWriteToken: jest.fn() }));

const storage = new VercelBlobStorage('token-rw');

describe('VercelBlobStorage', () => {
  it('emite token de envio restrito a um caminho, a PDF, a 10 MB e sem sobrescrever', async () => {
    jest.mocked(generateClientTokenFromReadWriteToken).mockResolvedValue('token-cliente');

    const instrucao = await storage.prepararUpload('insc-1-LATTES-abc');

    expect(instrucao).toEqual({ provedor: 'vercel-blob', pathname: 'pdfs/insc-1-LATTES-abc.pdf', token: 'token-cliente' });
    expect(generateClientTokenFromReadWriteToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'token-rw',
        pathname: 'pdfs/insc-1-LATTES-abc.pdf',
        allowedContentTypes: ['application/pdf'],
        maximumSizeInBytes: MAX_PDF_BYTES,
        addRandomSuffix: false,
        allowOverwrite: false,
      }),
    );
  });

  it('inspeciona tamanho e primeiros bytes, e devolve undefined quando nada foi enviado', async () => {
    jest.mocked(head).mockResolvedValueOnce({ size: 1234 } as Awaited<ReturnType<typeof head>>);
    const bytes = new TextEncoder().encode('%PDF-1.7');
    jest.mocked(get).mockResolvedValueOnce({
      statusCode: 200,
      stream: new ReadableStream<Uint8Array>({
        start: (c) => {
          c.enqueue(bytes);
          c.close();
        },
      }),
    } as unknown as Awaited<ReturnType<typeof get>>);

    const objeto = await storage.inspecionar('chave-1');
    expect(objeto?.tamanho).toBe(1234);
    expect(objeto?.inicio.toString('latin1')).toBe('%PDF-1.7');
    expect(get).toHaveBeenCalledWith('pdfs/chave-1.pdf', expect.objectContaining({ access: 'private' }));

    jest.mocked(head).mockRejectedValueOnce(new BlobNotFoundError());
    await expect(storage.inspecionar('chave-2')).resolves.toBeUndefined();
  });

  it('leitura por URL pré-assinada de curta duração, só para GET', async () => {
    jest.mocked(issueSignedToken).mockResolvedValue({ delegationToken: 'd', clientSigningToken: 'c', validUntil: 0 });
    jest.mocked(presignUrl).mockResolvedValue({ presignedUrl: 'https://x.private.blob.vercel-storage.com/pdfs/k.pdf?sig' });

    const url = await storage.urlDeLeitura('k');

    expect(url).toContain('blob.vercel-storage.com');
    expect(issueSignedToken).toHaveBeenCalledWith(expect.objectContaining({ pathname: 'pdfs/k.pdf', operations: ['get'] }));
    const validUntil = jest.mocked(issueSignedToken).mock.calls[0]![0].validUntil!;
    expect(validUntil - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});
