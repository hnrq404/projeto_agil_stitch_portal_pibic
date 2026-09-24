import { STATUS_LABELS } from "../../../convex/editais/rules";
import type { EditalStatus } from "../../../convex/editais/rules";

/** Cores semânticas do DESIGN.md (Semantic Status Signals). */
const STYLES: Record<EditalStatus, string> = {
  rascunho: "border-status-done-border bg-status-done-bg text-status-done",
  publicado: "border-status-ok-border bg-status-ok-bg text-[#047857]",
  em_avaliacao: "border-status-warn-border bg-status-warn-bg text-[#b45309]",
  encerrado: "border-status-done-border bg-status-done-bg text-status-done",
};

const ICONS: Record<EditalStatus, string> = {
  rascunho: "edit_note",
  publicado: "lock_open",
  em_avaliacao: "hourglass_top",
  encerrado: "task_alt",
};

/** Pill de status: cor + ícone + texto, nunca só cor (WCAG 1.4.1). */
export function StatusBadge({ status }: { status: EditalStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${STYLES[status]}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
        {ICONS[status]}
      </span>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** "14/20 bolsas alocadas" (formato do Backlog S2.4). */
export function CotaIndicator({ ocupadas, total }: { ocupadas: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((ocupadas / total) * 100)) : 0;
  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <span className="text-xs tabular-nums text-ink">
        <strong>{ocupadas}</strong>/{total} bolsas alocadas
      </span>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-hairline"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={ocupadas}
        aria-label={`${ocupadas} de ${total} bolsas alocadas`}
      >
        <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
