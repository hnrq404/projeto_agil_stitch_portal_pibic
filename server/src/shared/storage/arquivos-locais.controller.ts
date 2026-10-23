import type { Router } from 'express';

import { asyncHandler, pdfBodyParser, readUploadBody, sendPdf } from '../http/http.middleware';
import { ValidationError } from '../errors/domain.errors';

import type { ArmazenamentoLocal } from './arquivo.storage';

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

/**
 * Rotas que fazem o papel do Vercel Blob no dev local e nos testes. Não usam o
 * token de sessão: quem autoriza é a assinatura HMAC com validade curta, emitida
 * pela API depois de conferir a permissão (como a URL pré-assinada do Blob).
 *
 *   PUT /api/arquivos/envio/:chave?exp=&sig=        → recebe o PDF cru (application/pdf)
 *   GET /api/arquivos/:chave?exp=&nome=&sig=        → devolve o PDF para exibição
 */
export function registerArquivosLocaisRoutes(router: Router, storage: ArmazenamentoLocal): void {
  router.put(
    '/api/arquivos/envio/:chave',
    pdfBodyParser,
    asyncHandler(async (req, res) => {
      const conteudo = readUploadBody(req);
      if (conteudo.length === 0) {
        throw new ValidationError('Arquivo vazio ou sem Content-Type application/pdf.');
      }
      await storage.receberUpload(req.params['chave'] as string, texto(req.query['exp']), texto(req.query['sig']), conteudo);
      res.status(204).end();
    }),
  );

  router.get(
    '/api/arquivos/:chave',
    asyncHandler(async (req, res) => {
      const nome = texto(req.query['nome']);
      const conteudo = await storage.lerAssinado(
        req.params['chave'] as string,
        texto(req.query['exp']),
        nome,
        texto(req.query['sig']),
      );
      // O PdfViewer exibe o arquivo num iframe da própria página.
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'");
      sendPdf(res, conteudo, nome);
    }),
  );
}
