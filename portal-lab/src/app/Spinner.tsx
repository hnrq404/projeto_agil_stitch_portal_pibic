/** Spinner em tela cheia compartilhado por guards e páginas. */
export function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <span
        aria-hidden="true"
        className="material-symbols-outlined animate-spin text-[32px] text-navy"
      >
        progress_activity
      </span>
      <p className="text-sm text-muted" role="status">
        {label}
      </p>
    </div>
  );
}
