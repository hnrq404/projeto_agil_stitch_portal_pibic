import { useId, useRef, useState, type DragEvent } from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';

import { cn } from '@/shared/lib/cn';
import { formatBytes } from '@/shared/lib/format';

import { Button } from './Button';
import { Meter } from './DataDisplay';
import { REQUIRED_MARK } from './Form';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** RN06 no cliente: feedback imediato. O backend valida de novo (inclusive a assinatura do PDF). */
export function validarPdf(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return `"${file.name}" não é um PDF. Apenas arquivos PDF são aceitos.`;
  if (file.size > MAX_PDF_BYTES) return `"${file.name}" tem ${formatBytes(file.size)}. O limite é 10 MB.`;
  if (file.size === 0) return `"${file.name}" está vazio.`;
  return null;
}

interface FileDropzoneProps {
  label: string;
  description?: string;
  /** Arquivo já enviado (exibido com ações). */
  current?: { nome: string; tamanho: number } | null;
  onUpload: (file: File, onProgress: (pct: number) => void) => Promise<unknown>;
  onRemove?: () => void;
  onOpen?: () => void;
  disabled?: boolean;
  required?: boolean;
}

/** Dropzone do DESIGN.md: borda tracejada, selo "PDF até 10 MB" e progresso real do envio. */
export function FileDropzone({
  label,
  description,
  current,
  onUpload,
  onRemove,
  onOpen,
  disabled,
  required,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(file: File | undefined) {
    if (!file || disabled) return;
    const invalido = validarPdf(file);
    if (invalido) {
      setErro(invalido);
      return;
    }
    setErro(null);
    setProgress(0);
    try {
      await onUpload(file, setProgress);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha no envio.');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void enviar(event.dataTransfer.files[0]);
  }

  const enviando = progress !== null;

  return (
    <div className="space-y-2">
      <p className={cn('text-sm font-medium text-ink', required && REQUIRED_MARK)}>{label}</p>

      {current && !enviando ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
          <FileText className="h-8 w-8 shrink-0 text-rose-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{current.nome}</p>
            <p className="text-xs text-ink-subtle">PDF, {formatBytes(current.tamanho)}</p>
          </div>
          {onOpen && (
            <Button variant="ghost" size="sm" onClick={onOpen}>
              Visualizar
            </Button>
          )}
          {!disabled && (
            <>
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                Substituir
              </Button>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  aria-label={`Remover ${current.nome}`}
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                />
              )}
            </>
          )}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition',
            dragging ? 'border-primary bg-primary-soft' : 'border-slate-400 bg-canvas hover:border-primary',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <UploadCloud className="h-8 w-8 text-ink-subtle" aria-hidden />
          <span className="text-sm text-ink">
            <span className="font-semibold text-primary">Clique para escolher</span> ou arraste o arquivo aqui
          </span>
          {description && <span className="text-xs text-ink-subtle">{description}</span>}
          <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted ring-1 ring-line">
            PDF até 10 MB
          </span>
          {enviando && (
            <span className="mt-2 w-full max-w-xs space-y-1" aria-live="polite">
              <Meter value={progress} max={100} label={`Envio de ${label}`} tone="primary" />
              <span className="block text-xs text-ink-muted tnum">Enviando... {progress}%</span>
            </span>
          )}
        </label>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled || enviando}
        onChange={(e) => void enviar(e.target.files?.[0])}
        aria-label={label}
      />
      {erro && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {erro}
        </p>
      )}
    </div>
  );
}
