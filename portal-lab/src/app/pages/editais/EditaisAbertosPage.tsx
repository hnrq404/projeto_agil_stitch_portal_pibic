import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { PROGRAMAS, formatData, totalCotas } from "../../../../convex/editais/rules";
import type { Programa } from "../../../../convex/editais/rules";
import { prazoRelativo } from "../../../lib/dates";
import { PublicOrShell } from "../../PublicOrShell";
import { CotaIndicator, StatusBadge } from "../../ui/StatusBadge";

/** S2.4 / RF08 / RN04 — editais com inscrições abertas ou em análise, sem login. */
export function EditaisAbertosPage() {
  return (
    <PublicOrShell loadingLabel="Carregando editais…">
      <EditaisAbertos />
    </PublicOrShell>
  );
}

function EditaisAbertos() {
  const editais = useQuery(api.editais.queries.listarPublicos);
  const [programa, setPrograma] = useState<"todos" | Programa>("todos");

  const visiveis = useMemo(
    () => (editais ?? []).filter((e) => programa === "todos" || e.programa === programa),
    [editais, programa],
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-navy">Editais abertos</h1>
        <p className="text-sm text-muted">
          Editais com inscrições abertas ou em análise, com as bolsas de cada área. Os que encerram
          primeiro aparecem no topo.
        </p>
      </header>

      <div role="group" aria-label="Filtrar por programa" className="flex flex-wrap gap-2">
        {(["todos", ...PROGRAMAS] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={programa === p}
            onClick={() => setPrograma(p)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              programa === p ? "bg-navy text-white" : "bg-[#f1f5f9] text-muted hover:text-ink"
            }`}
          >
            {p === "todos" ? "Todos" : p}
          </button>
        ))}
      </div>

      {editais === undefined ? (
        <p className="text-sm text-muted" role="status">
          Carregando editais…
        </p>
      ) : visiveis.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-muted">
            event_busy
          </span>
          <h2 className="text-lg font-bold text-navy">Nenhum edital aberto no momento</h2>
          <p className="max-w-md text-sm text-muted">
            {programa === "todos"
              ? "Quando a PRPq publicar um novo edital, ele aparecerá aqui e quem tem conta no portal recebe uma notificação."
              : `Não há editais ${programa} abertos agora. Veja os outros programas em "Todos".`}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visiveis.map((e) => {
            const cotas = totalCotas(e.cotasPorArea);
            return (
              <li key={e._id} className="card flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[11px] text-muted">
                      {e.programa} {e.numero}
                    </span>
                    <h2 className="font-display text-base font-semibold text-navy">{e.titulo}</h2>
                  </div>
                  <StatusBadge status={e.status} />
                </div>

                <p className="flex items-center gap-1 text-xs text-muted">
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                    event
                  </span>
                  Inscrições de {formatData(e.dataAbertura)} a {formatData(e.dataEncerramento)}
                  {e.status === "publicado" && (
                    <strong className="ml-1 text-amber">
                      ({prazoRelativo(e.dataEncerramento)})
                    </strong>
                  )}
                </p>

                <ul className="flex flex-col gap-2 border-t border-hairline pt-3">
                  {e.cotasPorArea.map((c) => (
                    <li
                      key={c.area}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-ink">{c.area}</span>
                      <CotaIndicator ocupadas={c.ocupadas} total={c.total} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">
                  Total: <strong className="text-ink">{cotas.total}</strong> bolsas.
                  {e.status === "em_avaliacao" &&
                    " As inscrições já encerraram e as propostas estão sendo avaliadas."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
