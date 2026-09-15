import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { UserDto } from "../../../convex/users/index";
import { ROLES, ROLE_LABELS } from "../../../convex/roles";
import type { Role } from "../../../convex/roles";

/**
 * S1.2 / RF02 — Gestão de Papéis: listagem de usuários, alteração de papel
 * pelo Gestor PRPq e fila de homologação de papéis elevados.
 */
export function GestaoUsuariosPage() {
  const users = useQuery(api.users.queries.list);
  const pending = useQuery(api.users.queries.pendingRoles);
  const setRole = useMutation(api.users.mutations.setRole);
  const grantRequestedRole = useMutation(api.users.mutations.grantRequestedRole);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSetRole(userId: Id<"users">, papel: Role) {
    setBusyId(userId);
    setFeedback(null);
    try {
      await setRole({ userId, papel });
      setFeedback(`Papel atualizado para ${ROLE_LABELS[papel as keyof typeof ROLE_LABELS]}.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Falha ao atualizar papel.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleGrant(userId: Id<"users">) {
    setBusyId(userId);
    setFeedback(null);
    try {
      const res = (await grantRequestedRole({ userId })) as { papel?: string };
      setFeedback(
        `Solicitação homologada — papel concedido: ${res?.papel ? ROLE_LABELS[res.papel as keyof typeof ROLE_LABELS] : "—"} `,
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Falha ao homologar.");
    } finally {
      setBusyId(null);
    }
  }

  if (users === undefined || pending === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted">
        <span aria-hidden="true" className="material-symbols-outlined animate-spin text-[24px] text-navy">
          progress_activity
        </span>
        Carregando usuários…
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-navy">Gestão de Usuários & Papéis</h1>
        <p className="text-sm text-muted">
          Homologue solicitações de papel elevado e ajuste permissões da comunidade acadêmica (RF02/RN11).
        </p>
      </header>

      {feedback && (
        <div className="flex items-start gap-2 rounded-lg border border-status-ok-border bg-status-ok-bg p-3 text-xs text-ink" role="status">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-status-ok">check_circle</span>
          <span>{feedback}</span>
        </div>
      )}

      <div className="card flex flex-col gap-3 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-amber">pending_actions</span>
          Fila de Homologação
          <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-bold text-amber">
            {pending.length} pendente{pending.length === 1 ? "" : "s"}
          </span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-xs text-muted">Nenhuma solicitação aguardando homologação.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {pending.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-navy">{u.name ?? "Sem nome"}</span>
                  <span className="text-xs text-muted">
                    {u.email} · {u.departamento ?? "—"} · papel atual: {ROLE_LABELS[u.papel]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[11px] font-bold text-amber">
                    solicita {u.papeisSolicitados?.map((r) => ROLE_LABELS[r]).join(", ")}
                  </span>
                  <button
                    type="button"
                    className="btn-primary px-3 text-xs"
                    disabled={busyId === u._id}
                    onClick={() => void handleGrant(u._id)}
                  >
                    Homologar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-hairline px-5 py-4">
          <h2 className="font-display text-lg font-bold text-navy">Usuários da Comunidade</h2>
          <p className="text-xs text-muted">{users.length} conta(s) registradas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline bg-canvas text-[11px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-semibold">Usuário</th>
                <th className="px-5 py-3 font-semibold">Vínculo</th>
                <th className="px-5 py-3 font-semibold">Papel Atual</th>
                <th className="px-5 py-3 font-semibold">Alterar Papel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {users.map((u: UserDto) => (
                <tr key={u._id} className="hover:bg-canvas">
                  <td className="px-5 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-navy">{u.name ?? "—"}</span>
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
                        solicita
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      className="field h-8 w-44"
                      value={u.papel}
                      disabled={busyId === u._id}
                      onChange={(e) => void handleSetRole(u._id, e.target.value as Role)}
                      aria-label={`Alterar papel de ${u.name ?? u.email}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
