import { useState } from "react";

/**
 * Stepper do formulário multi-etapas (DESIGN.md — Multi-Step Research
 * Registration Forms): etapas concluídas exibem check teal; a etapa atual tem
 * círculo navy e rótulo em negrito. Etapas futuras permanecem bloqueadas.
 */
export type Step = { id: string; titulo: string };

export function Stepper({
  etapas,
  atual,
  onIrPara,
}: {
  etapas: Step[];
  atual: number;
  onIrPara: (indice: number) => void;
}) {
  return (
    <nav aria-label="Progresso do formulário" className="flex flex-wrap items-center gap-2">
      {etapas.map((etapa, i) => {
        const concluida = i < atual;
        const corrente = i === atual;
        return (
          <span key={etapa.id} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-hairline-strong">
                chevron_right
              </span>
            )}
            <button
              type="button"
              disabled={!concluida}
              onClick={() => onIrPara(i)}
              aria-current={corrente ? "step" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors ${
                corrente
                  ? "bg-hairline font-bold text-navy"
                  : concluida
                    ? "text-teal hover:bg-hairline"
                    : "text-muted"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  concluida
                    ? "bg-teal text-white"
                    : corrente
                      ? "border-2 border-navy text-navy"
                      : "bg-hairline text-muted"
                }`}
              >
                {concluida ? (
                  <span className="material-symbols-outlined text-[14px]">check</span>
                ) : (
                  i + 1
                )}
              </span>
              {etapa.titulo}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

/** Dropzone de anexo PDF (DESIGN.md): borda tracejada, validação e progresso. */
export function DropzonePdf({
  rotulo,
  obrigatorio,
  arquivo,
  progresso,
  onArquivo,
  onRemover,
}: {
  rotulo: string;
  obrigatorio: boolean;
  arquivo: { nome: string; tamanho: string } | null;
  progresso: number | null;
  onArquivo: (file: File) => void;
  onRemover: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    setErro(null);
    const file = files?.[0];
    if (!file) return;
    const valid = validarPdfClient(file);
    if (valid) {
      setErro(valid);
      return;
    }
    onArquivo(file);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="label">
        {rotulo} {obrigatorio && <span className="text-status-bad">*</span>}
      </span>
      {arquivo ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-canvas p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="material-symbols-outlined text-[26px] text-status-bad">
              picture_as_pdf
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-navy">{arquivo.nome}</span>
              <span className="font-mono text-[11px] text-muted">{arquivo.tamanho}</span>
            </div>
          </div>
          {progresso !== null && progresso < 100 ? (
            <div className="flex w-32 flex-col gap-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
                <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <span className="text-right font-mono text-[10px] text-muted">{progresso}%</span>
            </div>
          ) : (
            <button type="button" className="btn-secondary px-3 text-xs" onClick={onRemover}>
              Remover
            </button>
          )}
        </div>
      ) : (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#94a3b8] bg-canvas p-6 text-center transition-colors hover:bg-hairline ${
            erro ? "border-status-bad" : ""
          }`}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-navy">
            cloud_upload
          </span>
          <span className="text-xs font-semibold text-navy">Clique ou arraste o documento em PDF aqui</span>
          <span className="text-[11px] text-muted">
            <span className="rounded bg-hairline px-1.5 py-0.5 font-mono font-bold">PDF até 10 MB</span> — RN06
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      )}
      {erro && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-status-bad" role="alert">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">error</span>
          {erro}
        </p>
      )}
    </div>
  );
}

function validarPdfClient(file: File): string | null {
  const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!ehPdf) return "Formato inválido: apenas PDF é aceito (RN06).";
  if (file.size > 10 * 1024 * 1024) return "Arquivo acima do limite de 10 MB (RN06).";
  return null;
}
