import fs from 'node:fs';
import path from 'node:path';

import { ForbiddenError, ValidationError } from '../../src/shared/errors/domain.errors';
import { CONTENT_SECURITY_POLICY } from '../../src/shared/http/security.middleware';
import { assertPdfEnviado, InMemoryArquivoStorage, MAX_PDF_BYTES } from '../../src/shared/storage/arquivo.storage';

const PDF = Buffer.from('%PDF-1.4 conteudo');

function parametros(url: string) {
  const u = new URL(url, 'http://localhost');
  return { chave: u.pathname.split('/').pop()!, exp: u.searchParams.get('exp')!, sig: u.searchParams.get('sig')! };
}

describe('Armazenamento local com URLs assinadas', () => {
  it('aceita o envio na URL emitida e devolve o arquivo pela URL de leitura', async () => {
    const storage = new InMemoryArquivoStorage('segredo');
    const instrucao = await storage.prepararUpload('insc-1-PLANO_TRABALHO-abc');
    if (instrucao.provedor !== 'api') throw new Error('esperava envio pela API');
    const { chave, exp, sig } = parametros(instrucao.url);

    await storage.receberUpload(chave, exp, sig, PDF);

    expect(await storage.inspecionar(chave)).toEqual({ tamanho: PDF.length, inicio: PDF.subarray(0, 8) });
    const leitura = new URL(await storage.urlDeLeitura(chave, 'plano.pdf'), 'http://localhost');
    const conteudo = await storage.lerAssinado(
      chave,
      leitura.searchParams.get('exp')!,
      leitura.searchParams.get('nome')!,
      leitura.searchParams.get('sig')!,
    );
    expect(conteudo.equals(PDF)).toBe(true);
  });

  it('recusa assinatura adulterada, chave trocada e link vencido', async () => {
    let agora = 1_000_000;
    const storage = new InMemoryArquivoStorage('segredo', () => agora);
    const instrucao = await storage.prepararUpload('chave-a');
    if (instrucao.provedor !== 'api') throw new Error('esperava envio pela API');
    const { exp, sig } = parametros(instrucao.url);

    await expect(storage.receberUpload('chave-a', exp, `${sig}x`, PDF)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(storage.receberUpload('chave-b', exp, sig, PDF)).rejects.toBeInstanceOf(ForbiddenError);
    agora += 16 * 60 * 1000;
    await expect(storage.receberUpload('chave-a', exp, sig, PDF)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('assinaturas de outro segredo não valem', async () => {
    const instrucao = await new InMemoryArquivoStorage('segredo-1').prepararUpload('chave-a');
    if (instrucao.provedor !== 'api') throw new Error('esperava envio pela API');
    const { exp, sig } = parametros(instrucao.url);
    await expect(new InMemoryArquivoStorage('segredo-2').receberUpload('chave-a', exp, sig, PDF)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('recusa chaves que poderiam escapar da pasta (path traversal)', async () => {
    const storage = new InMemoryArquivoStorage();
    await expect(storage.prepararUpload('../../etc/passwd')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('assertPdfEnviado', () => {
  it('exige que o arquivo tenha chegado, não esteja vazio, caiba em 10 MB e seja PDF', () => {
    expect(() => assertPdfEnviado(undefined)).toThrow(/não chegou/);
    expect(() => assertPdfEnviado({ tamanho: 0, inicio: Buffer.alloc(0) })).toThrow(/vazio/);
    expect(() => assertPdfEnviado({ tamanho: MAX_PDF_BYTES + 1, inicio: PDF })).toThrow(/10 MB/);
    expect(() => assertPdfEnviado({ tamanho: 10, inicio: Buffer.from('MZ\x90\x00') })).toThrow(/PDF/);
    expect(() => assertPdfEnviado({ tamanho: 10, inicio: PDF })).not.toThrow();
  });
});

describe('CSP', () => {
  it('é a mesma no Express e nos arquivos estáticos servidos pela Vercel', () => {
    const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../vercel.json'), 'utf8')) as {
      headers: { headers: { key: string; value: string }[] }[];
    };
    const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
    expect(csp?.value).toBe(CONTENT_SECURITY_POLICY);
  });
});
