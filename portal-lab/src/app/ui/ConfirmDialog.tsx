import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmação antes de ações com consequência (Nielsen #5) com saída clara
 * — botão "Cancelar", tecla Esc e clique fora (Nielsen #3). Usa o <dialog>
 * nativo para herdar foco preso e semântica acessível do navegador.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,440px)] rounded-xl border border-hairline bg-card p-0 text-ink shadow-[var(--shadow-card-hover)] backdrop:bg-ink/40"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id="confirm-title" className="font-display text-lg font-bold text-navy">
          {title}
        </h2>
        <div className="text-sm text-muted">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary px-4" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary px-4" onClick={onConfirm} disabled={busy}>
            {busy ? "Aplicando…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
