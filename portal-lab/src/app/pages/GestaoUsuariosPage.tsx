import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { UserDto } from "../../../convex/users/index";
import { ROLES, ROLE_LABELS } from "../../../convex/roles";
import type { Role } from "../../../convex/roles";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { friendlyError } from "../../lib/errors";
import { Alert } from "../ui/Alert";
import { ConfirmDialog } from "../ui/ConfirmDialog";

/** Mudança aguardando confirmação no diálogo (Nielsen #5). */
type PendingChange = { user: UserDto; papel: Role; kind: "set" | "grant" };

/** Estado anterior guardado para o "Desfazer" (Nielsen #3). */
type Undo = { userId: Id<"users">; papel: Role; papeisSolicitados: Role[] };

type Feedback = { tone: "success" | "error"; message: string; undo?: Undo };

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * S1.2 / RF02 — Gestão de Papéis: listagem de usuários, alteração de papel
 * pelo Gestor PRPq e fila de homologação de papéis elevados.
 */
export function GestaoUsuariosPage() {
  const users = useQuery(api.users.queries.list);
  const pending = useQuery(api.users.queries.pendingRoles);
  const setRole = useMutation(api.users.mutations.setRole);
  const grantRequestedRole = useMutation(api.users.mutations.grantRequestedRole);
  const { user: me } = useCurrentUser();

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [change, setChange] = useState<PendingChange | null>(null);
  const [query, setQuery] = useState("");

  // Nielsen #7: busca para quem administra centenas de contas.
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!users || !q) return users ?? [];
    return users.filter((u) =>
      normalize([u.name, u.email, u.matricula, u.departamento].filter(Boolean).join(" ")).includes(
        q,
      ),
    );
  }, [users, query]);

  async function applyChange() {
    if (!change) return;
    const { user, papel, kind } = change;
    const undo: Undo = {
      userId: user._id,
      papel: user.papel,
      papeisSolicitados: user.papeisSolicitados ?? [],
    };
    const who = user.name ?? user.email ?? "o usuário";
    setBusy(true);
    try {
      if (kind === "grant") {
        const res = await grantRequestedRole({ userId: user._id });
        setFeedback({
          tone: "success",
          message: `Pedido aprovado: ${who} agora é ${ROLE_LABELS[res.papel]}.`,
          undo,
        });
      } else {
        await setRole({ userId: user._id, papel });
        setFeedback({
          tone: "success",
          message: `Perfil de ${who} alterado para ${ROLE_LABELS[papel]}.`,
          undo,
        });
      }
    } catch (err) {
      setFeedback({
        tone: "error",
        message: friendlyError(
          err,
          `Não foi possível alterar o perfil de ${who}. Tente novamente.`,
        ),
      });
    } finally {
      setBusy(false);
      setChange(null);
    }
  }

  async function handleUndo(undo: Undo) {
    setBusy(true);
    try {
      await setRole(undo);
      setFeedback({
        tone: "success",
        message: "Alteração desfeita. O perfil voltou ao que era antes.",
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        message: friendlyError(
          err,
          "Não foi possível desfazer. Ajuste o perfil manualmente na tabela.",
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  if (users === undefined || pending === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted" role="status">
        <span
          aria-hidden="true"
          className="material-symbols-outlined animate-spin text-[24px] text-navy"
        >
          progress_activity
        </span>
        Carregando usuários…
      </div>
    );
  }

  const demotingSelf = change && me && change.user._id === me._id && change.papel !== "admin";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-navy">Gestão de Usuários</h1>
        <p className="text-sm text-muted">
          Aprove pedidos de acesso de docentes e avaliadores e ajuste o perfil de cada pessoa. As
          mudanças valem na hora.
        </p>
      </header>

      {feedback && (
        <Alert
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
          action={
            feedback.undo && (
              <button
                type="button"
                className="text-xs font-semibold text-navy underline"
                disabled={busy}
                onClick={() => void handleUndo(feedback.undo!)}
              >
                Desfazer
              </button>
            )
          }
        >
          {feedback.message}
        </Alert>
      )}

      <div className="card flex flex-col gap-3 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-amber">
            pending_actions
          </span>
          Pedidos aguardando aprovação
          <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-bold text-amber">
            {pending.length}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-xs text-muted">Tudo em dia — nenhum pedido aguardando aprovação.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {pending.map((u) => {
              const requested = u.papeisSolicitados?.[0];
              return (
                <li key={u._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-navy">{u.name ?? "Sem nome"}</span>
                    <span className="text-xs text-muted">
                      {u.email} · {u.departamento ?? "unidade não informada"} · matr.{" "}
                      {u.matricula ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      Pede para passar de {ROLE_LABELS[u.papel]} para{" "}
                      <strong className="text-amber">
                        {requested ? ROLE_LABELS[requested] : "—"}
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="btn-primary px-3 text-xs"
                      disabled={busy || !requested}
                      onClick={() =>
                        requested && setChange({ user: u, papel: requested, kind: "grant" })
                      }
                    >
                      Aprovar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-navy">Pessoas cadastradas</h2>
            <p className="text-xs text-muted" aria-live="polite">
              {query
                ? `${filtered.length} de ${users.length} conta(s) encontradas`
                : `${users.length} conta(s) cadastradas`}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <span
              aria-hidden="true"
              className="material-symbols-outlined absolute left-3 top-2.5 text-[20px] text-hairline-strong"
            >
              search
            </span>
            <label htmlFor="user-search" className="sr-only">
              Buscar pessoa
            </label>
            <input
              id="user-search"
              type="search"
              className="field pl-10"
              placeholder="Nome, e-mail ou matrícula"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline bg-canvas text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Pessoa</th>
                <th className="px-5 py-3 font-semibold">Vínculo</th>
                <th className="px-5 py-3 font-semibold">Perfil atual</th>
                <th className="px-5 py-3 font-semibold">Alterar perfil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-muted">
                    Ninguém encontrado para “{query}”.{" "}
                    <button
                      type="button"
                      className="text-teal underline"
                      onClick={() => setQuery("")}
                    >
                      Limpar busca
                    </button>
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u._id} className="hover:bg-canvas">
                  <td className="px-5 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-navy">
                        {u.name ?? "—"}
                        {me?._id === u._id && (
                          <span className="ml-1 font-normal text-muted">(você)</span>
                        )}
                      </span>
                      <span className="font-mono text-[11px] text-muted">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    <div className="flex flex-col">
                      <span>{u.departamento ?? "—"}</span>
                      <span className="font-mono text-[11px]">matr. {u.matricula ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-canvas px-2 py-0.5 font-bold text-navy">
                      {ROLE_LABELS[u.papel]}
                    </span>
                    {(u.papeisSolicitados?.length ?? 0) > 0 && (
                      <span className="ml-1 rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-bold text-amber">
                        pedido pendente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      className="field h-8 w-44"
                      value={u.papel}
                      disabled={busy}
                      onChange={(e) =>
                        setChange({ user: u, papel: e.target.value as Role, kind: "set" })
                      }
                      aria-label={`Alterar perfil de ${u.name ?? u.email}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={change !== null}
        title={change?.kind === "grant" ? "Aprovar pedido de acesso?" : "Alterar perfil?"}
        confirmLabel={change?.kind === "grant" ? "Aprovar" : "Alterar perfil"}
        busy={busy}
        onConfirm={() => void applyChange()}
        onCancel={() => setChange(null)}
      >
        {change && (
          <div className="flex flex-col gap-3">
            <p>
              <strong className="text-ink">{change.user.name ?? change.user.email}</strong> passará
              de <strong className="text-ink">{ROLE_LABELS[change.user.papel]}</strong> para{" "}
              <strong className="text-ink">{ROLE_LABELS[change.papel]}</strong> e verá imediatamente
              as áreas desse perfil.
            </p>
            {demotingSelf && (
              <Alert tone="warning" title="Você está alterando o seu próprio perfil">
                Você perderá o acesso à Gestão de Usuários e não poderá desfazer esta mudança
                sozinho.
              </Alert>
            )}
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}
