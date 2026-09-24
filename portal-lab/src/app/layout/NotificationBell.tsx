import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";

/**
 * Notificações in-app (S2: "edital publicado"). O contador mostra o que é
 * novo (Nielsen #1); o painel fecha com Esc ou clique fora (Nielsen #3).
 */
export function NotificationBell() {
  const data = useQuery(api.notificacoes.minhas);
  const marcarLida = useMutation(api.notificacoes.marcarLida);
  const marcarTodas = useMutation(api.notificacoes.marcarTodasLidas);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const naoLidas = data?.naoLidas ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="painel-notificacoes"
        aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lida(s)` : "Notificações"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-navy"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
          notifications
        </span>
        {naoLidas > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-bad px-1 text-[10px] font-bold text-white"
          >
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div
          id="painel-notificacoes"
          className="absolute right-0 top-11 z-50 w-[min(92vw,360px)] rounded-xl border border-hairline bg-card shadow-[var(--shadow-card-hover)]"
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <h2 className="text-sm font-bold text-navy">Notificações</h2>
            {naoLidas > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-teal hover:underline"
                onClick={() => void marcarTodas({})}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          {!data || data.itens.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted">
              Você não tem notificações. Avisaremos aqui quando um novo edital for publicado.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-hairline overflow-y-auto">
              {data.itens.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-canvas ${n.lida ? "" : "bg-[#f0f7ff]"}`}
                    onClick={() => {
                      if (!n.lida) void marcarLida({ id: n._id });
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <span className="flex items-center gap-1 text-xs font-bold text-navy">
                      {!n.lida && (
                        <span className="h-2 w-2 rounded-full bg-teal" aria-hidden="true" />
                      )}
                      {n.titulo}
                      {!n.lida && <span className="sr-only">(não lida)</span>}
                    </span>
                    <span className="text-xs text-muted">{n.mensagem}</span>
                    <span className="text-[11px] text-hairline-strong">
                      {new Date(n.em).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
