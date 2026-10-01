import { FileText } from 'lucide-react';

import { errorMessage } from '@/shared/api/http';
import { formatBytes } from '@/shared/lib/format';
import { ANEXO_LABEL } from '@/shared/lib/labels';
import type { Inscricao } from '@/shared/types/api';
import { Tag } from '@/shared/ui/Badge';
import { abrirPdf } from '@/shared/ui/PdfViewer';
import { useToast } from '@/shared/ui/Toast';

import { anexoUrl } from './api';

/** Conteúdo da proposta (somente leitura): usado no detalhe, na triagem e na avaliação. */
export function PropostaConteudo({ inscricao, mostrarAnexos = true }: { inscricao: Inscricao; mostrarAnexos?: boolean }) {
  const toast = useToast();
  const palavras = inscricao.palavrasChave
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {inscricao.subareaNome && <Tag>{`${inscricao.subareaCode} ${inscricao.subareaNome}`}</Tag>}
        {palavras.map((p) => (
          <span key={p} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {p}
          </span>
        ))}
      </div>
      <Secao titulo="Resumo">{inscricao.resumo}</Secao>
      <Secao titulo="Objetivos">{inscricao.objetivos}</Secao>
      <Secao titulo="Metodologia">{inscricao.metodologia}</Secao>

      {mostrarAnexos && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Documentos anexados</h3>
          {inscricao.anexos.length === 0 ? (
            <p className="text-sm text-ink-muted">Nenhum documento anexado.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {inscricao.anexos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => void abrirPdf(anexoUrl(inscricao.id, a.id)).catch((e) => toast.error(errorMessage(e)))}
                    className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition hover:border-line-strong hover:bg-canvas"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-rose-700" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{ANEXO_LABEL[a.tipo]}</span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {a.nome}, {formatBytes(a.tamanho)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: string }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{titulo}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{children || '-'}</p>
    </section>
  );
}
