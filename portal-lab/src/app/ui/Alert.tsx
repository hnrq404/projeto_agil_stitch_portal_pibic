import type { ReactNode } from "react";

type Tone = "error" | "success" | "info" | "warning";

const TONES: Record<
  Tone,
  { icon: string; box: string; iconColor: string; role: "alert" | "status" }
> = {
  error: {
    icon: "error",
    box: "border-status-bad-border bg-status-bad-bg",
    iconColor: "text-status-bad",
    role: "alert",
  },
  success: {
    icon: "check_circle",
    box: "border-status-ok-border bg-status-ok-bg",
    iconColor: "text-status-ok",
    role: "status",
  },
  warning: {
    icon: "warning",
    box: "border-status-warn-border bg-status-warn-bg",
    iconColor: "text-status-warn",
    role: "status",
  },
  info: {
    icon: "info",
    box: "border-hairline bg-canvas",
    iconColor: "text-teal",
    role: "status",
  },
};

type AlertProps = {
  tone: Tone;
  title?: string;
  children: ReactNode;
  /** Ação de recuperação (ex.: "Desfazer", "Tentar novamente") — Nielsen #3/#9. */
  action?: ReactNode;
  onDismiss?: () => void;
};

/**
 * Mensagem de feedback única para todo o portal (Nielsen #1, #4 e #9):
 * mesmo visual, ícone e semântica ARIA para erros, sucessos e avisos.
 */
export function Alert({ tone, title, children, action, onDismiss }: AlertProps) {
  const t = TONES[tone];
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-xs text-ink ${t.box}`}
      role={t.role}
    >
      <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${t.iconColor}`}>
        {t.icon}
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        {title && <strong className="text-sm">{title}</strong>}
        <span>{children}</span>
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar mensagem"
          className="text-muted hover:text-ink"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            close
          </span>
        </button>
      )}
    </div>
  );
}
