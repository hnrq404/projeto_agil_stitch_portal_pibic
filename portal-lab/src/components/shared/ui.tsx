import { Component, type ErrorInfo, type ReactNode } from "react";

type StatusKind = "ok" | "warn" | "done" | "bad";

const STATUS_STYLES: Record<StatusKind, { bg: string; text: string; icon: string }> = {
  ok: { bg: "bg-status-ok-bg border-status-ok-border", text: "text-[#065f46]", icon: "check_circle" },
  warn: { bg: "bg-status-warn-bg border-status-warn-border", text: "text-status-warn", icon: "pending" },
  done: { bg: "bg-status-done-bg border-status-done-border", text: "text-status-done", icon: "check_circle" },
  bad: { bg: "bg-status-bad-bg border-status-bad-border", text: "text-status-bad", icon: "cancel" },
};

export const STATUS_LABELS: Record<string, { label: string; kind: StatusKind }> = {
  rascunho: { label: "Rascunho", kind: "warn" },
  submetida: { label: "Submetida", kind: "ok" },
  em_triagem: { label: "Em Triagem", kind: "warn" },
  avaliada: { label: "Avaliada", kind: "done" },
  aprovada: { label: "Aprovada", kind: "ok" },
  recusada: { label: "Recusada", kind: "bad" },
};

/**
 * Badge pill de status (DESIGN.md — Semantic Status Signals): cor + ícone +
 * texto, nunca apenas cor (WCAG 2.1 AA — sinalizadores não exclusivos de cor).
 */
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, kind: "done" as StatusKind };
  const style = STATUS_STYLES[cfg.kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${style.bg} ${style.text}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
        {style.icon}
      </span>
      {cfg.label}
    </span>
  );
}

/**
 * ErrorBoundary de UI: captura erros de render/queries reativas (ex.:
 * ConvexError lançado no cliente) e exibe um fallback com CTA em vez de
 * derrubar a SPA em página branca. Sem lógica de domínio — genérico.
 */
type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError() {
    return { falhou: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ui] ErrorBoundary capturou:", error, info.componentStack);
  }

  render() {
    return this.state.falhou ? this.props.fallback : this.props.children;
  }
}

/** Estado vazio com CTA (polish pass — mockups Stitch). */
export function EmptyState({
  icon,
  titulo,
  descricao,
  acao,
}: {
  icon: string;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-teal">
        {icon}
      </span>
      <h2 className="font-display text-lg font-bold text-navy">{titulo}</h2>
      <p className="max-w-md text-sm text-muted">{descricao}</p>
      {acao}
    </div>
  );
}

/** Cabeçalho padrão de página: título, subtítulo e ação contextual. */
export function PageHeader({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy">{titulo}</h1>
        {subtitulo && <p className="max-w-3xl text-sm text-muted">{subtitulo}</p>}
      </div>
      {acao}
    </header>
  );
}
