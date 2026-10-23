import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';

import { errorMessage, http, saveBlob } from '@/shared/api/http';

import { Button } from './Button';
import { Alert, LoadingState } from './Feedback';

interface PdfViewerProps {
  /** Rota da API que confere a permissão e devolve o link temporário do PDF. */
  src: string;
  nome: string;
  className?: string;
}

interface LinkPdf {
  nome: string;
  /** Link que expira em minutos (Vercel Blob privado ou rota assinada da API no dev). */
  url: string;
}

/** Pede à API o link temporário do PDF; a permissão é conferida lá. */
export function obterLinkPdf(src: string): Promise<LinkPdf> {
  return http.get<LinkPdf>(src);
}

/** Pré-visualização de PDF protegido, exibido pelo link temporário. */
export function PdfViewer({ src, nome, className }: PdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  useEffect(() => {
    let ativo = true;
    setUrl(null);
    setErro(null);
    obterLinkPdf(src)
      .then((link) => ativo && setUrl(link.url))
      .catch((e: unknown) => ativo && setErro(e));
    return () => {
      ativo = false;
    };
  }, [src]);

  if (erro) return <Alert tone="danger" title="Não foi possível abrir o PDF">{errorMessage(erro)}</Alert>;
  if (!url) return <LoadingState label="Carregando documento..." />;

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<ExternalLink className="h-4 w-4" aria-hidden />}
          onClick={() => void abrirPdf(src)}
        >
          Abrir em nova aba
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="h-4 w-4" aria-hidden />}
          onClick={() => void baixarPdf(src, nome)}
        >
          Baixar
        </Button>
      </div>
      <iframe title={`Documento: ${nome}`} src={url} className="h-[70vh] w-full rounded-lg border border-line bg-white" />
    </div>
  );
}

/**
 * Abre um PDF protegido em nova aba. A aba é aberta antes da chamada à API,
 * ainda dentro do clique, para o bloqueador de pop-ups não barrar.
 */
export async function abrirPdf(src: string): Promise<void> {
  const janela = window.open('', '_blank');
  try {
    const { url } = await obterLinkPdf(src);
    if (janela) {
      janela.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    janela?.close();
    throw error;
  }
}

/**
 * Baixa com o nome original. Se o armazenamento não permitir a leitura pelo
 * script (CORS), abre o link e o navegador oferece o download.
 */
async function baixarPdf(src: string, nome: string): Promise<void> {
  const { url } = await obterLinkPdf(src);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    saveBlob(await res.blob(), nome);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
