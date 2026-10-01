import { useEffect, useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';

import { errorMessage, fetchBlob, saveBlob } from '@/shared/api/http';

import { Button } from './Button';
import { Alert, LoadingState } from './Feedback';

interface PdfViewerProps {
  /** Rota da API que devolve o PDF (exige o token, por isso não usamos src direto). */
  src: string;
  nome: string;
  className?: string;
}

/** Pré-visualização de PDF protegido: baixa com o token e exibe via blob URL. */
export function PdfViewer({ src, nome, className }: PdfViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  useEffect(() => {
    let ativo = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setErro(null);
    fetchBlob(src)
      .then((b) => {
        if (!ativo) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch((e: unknown) => ativo && setErro(e));
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
          onClick={() => window.open(url, '_blank', 'noopener')}
        >
          Abrir em nova aba
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="h-4 w-4" aria-hidden />}
          onClick={() => blob && saveBlob(blob, nome)}
        >
          Baixar
        </Button>
      </div>
      <iframe title={`Documento: ${nome}`} src={url} className="h-[70vh] w-full rounded-lg border border-line bg-white" />
    </div>
  );
}

/** Abre um PDF protegido em nova aba (sem embutir na página). */
export async function abrirPdf(src: string): Promise<void> {
  const janela = window.open('', '_blank');
  const blob = await fetchBlob(src);
  const url = URL.createObjectURL(blob);
  if (janela) {
    janela.location.href = url;
  } else {
    window.location.href = url;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
