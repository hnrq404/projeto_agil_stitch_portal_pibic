import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import {
  EDITAL_STATUSES,
  STATUS_LABELS,
  formatData,
  totalCotas,
} from "../../../../convex/editais/rules";
import type { EditalStatus } from "../../../../convex/editais/rules";
import { prazoRelativo } from "../../../lib/dates";
import { CotaIndicator, StatusBadge } from "../../ui/StatusBadge";

type Filtro = "todos" | EditalStatus;

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** S2.1–S2.3 — visão do gestor: todos os editais, em qualquer situação. */
export function EditaisPage() {
  const editais = useQuery(api.editais.queries.listar);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [query, setQuery] = useState("");

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = {
      todos: 0,
      rascunho: 0,
      publicado: 0,
      em_avaliacao: 0,
      encerrado: 0,
    };
    for (const e of editais ?? []) {
      c.todos++;
      c[e.status]++;
    }
    return c;
  }, [editais]);

  const visiveis = useMemo(() => {
    const q = normalize(query.trim());
    return (editais ?? []).filter(
      (e) =>
        (filtro === "todos" || e.status === filtro) &&
        (!q || normalize(`${e.numero} ${e.titulo} ${e.programa}`).includes(q)),
    );
  }, [editais, filtro, query]);

  if (editais === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted" role="status">
        <span
          aria-hidden="true"
          className="material-symbols-outlined animate-spin text-[24px] text-navy"
        >
          progress_activity
        </span>
        Carregando editais…
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold text-navy">Editais</h1>
          <p className="text-sm text-muted">
            Rascunhos ficam visíveis só para a gestão até serem publicados.
          </p>
        </div>
        <Link to="/editais/novo" className="btn-primary px-4">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            add
          </span>
          Novo edital
        </Link>
      </header>

      {editais.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-teal">
            description
          </span>
          <h2 className="text-lg font-bold text-navy">Nenhum edital cadastrado ainda</h2>
          <p className="max-w-md text-sm text-muted">
            Crie o primeiro edital como rascunho. Você pode revisar tudo com calma antes de publicar
            para a comunidade.
          </p>
          <Link to="/editais/novo" className="btn-primary px-4">
            Criar primeiro edital
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-hairline px-5 py-4">
            <div className="relative w-full sm:w-80">
              <span
                aria-hidden="true"
                className="material-symbols-outlined absolute left-3 top-2.5 text-[20px] text-hairline-strong"
              >
                search
              </span>
              <label htmlFor="edital-search" className="sr-only">
                Buscar edital
              </label>
              <input
                id="edital-search"
                type="search"
                className="field pl-10"
                placeholder="Número, título ou programa"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
              {(["todos", ...EDITAL_STATUSES] as Filtro[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filtro === f}
                  onClick={() => setFiltro(f)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    filtro === f ? "bg-navy text-white" : "bg-[#f1f5f9] text-muted hover:text-ink"
                  }`}
                >
                  {f === "todos" ? "Todos" : STATUS_LABELS[f]} ({contagem[f]})
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-hairline bg-canvas text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold">Edital</th>
                  <th className="px-5 py-3 font-semibold">Situação</th>
                  <th className="px-5 py-3 font-semibold">Inscrições</th>
                  <th className="px-5 py-3 font-semibold">Bolsas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-muted">
                      Nenhum edital com esses filtros.{" "}
                      <button
                        type="button"
                        className="text-teal underline"
                        onClick={() => {
                          setFiltro("todos");
                          setQuery("");
                        }}
                      >
                        Limpar filtros
                      </button>
                    </td>
                  </tr>
                )}
                {visiveis.map((e) => {
                  const cotas = totalCotas(e.cotasPorArea);
                  return (
                    <tr key={e._id} className="hover:bg-canvas">
                      <td className="px-5 py-3">
                        <Link to={`/editais/${e._id}`} className="group flex flex-col">
                          <span className="font-mono text-[11px] text-muted">
                            {e.programa} {e.numero}
                          </span>
                          <span className="font-semibold text-navy group-hover:underline">
                            {e.titulo}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-5 py-3 text-muted">
                        <span className="block tabular-nums">
                          {formatData(e.dataAbertura)} a {formatData(e.dataEncerramento)}
                        </span>
                        {e.status === "publicado" && (
                          <span className="text-[11px] font-semibold text-amber">
                            {prazoRelativo(e.dataEncerramento)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <CotaIndicator ocupadas={cotas.ocupadas} total={cotas.total} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
