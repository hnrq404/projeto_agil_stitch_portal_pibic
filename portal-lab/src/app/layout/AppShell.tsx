import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { UserDto } from "../../../convex/users/index";
import { ROLE_LABELS } from "../../../convex/roles";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  user: UserDto | null;
  children: React.ReactNode;
};

/**
 * Shell autenticada (S1.3): sidebar responsiva por papel + header com
 * identidade do usuário e logout (S1.1/RF01). Após o logout o usuário é
 * levado ao login (RN12 — sessão encerrada exige nova autenticação).
 */
export function AppShell({ user, children }: AppShellProps) {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const roleLabel = user ? ROLE_LABELS[user.papel] : "";
  const adminExists = useQuery(api.users.queries.adminExists);
  const claimBootstrapAdmin = useMutation(api.users.mutations.claimBootstrapAdmin);
  const [claiming, setClaiming] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  async function handleClaimAdmin() {
    if (!user) return;
    setClaiming(true);
    try {
      await claimBootstrapAdmin({});
      // Recarrega para que queries restritas a admin sejam reavaliadas.
      window.location.reload();
    } catch {
      setClaiming(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-hairline bg-card lg:block">
        <Sidebar user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-hairline bg-card px-4 lg:px-8">
          {/* Drawer mobile (tablet/mobile: 8/4 colunas do DESIGN.md) */}
          <details className="group relative lg:hidden">
            <summary
              aria-label="Abrir menu de navegação"
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-hairline-strong"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-navy">
                menu
              </span>
            </summary>
            <div className="absolute left-0 top-12 z-50 w-64 rounded-xl border border-hairline bg-card shadow-[var(--shadow-card-hover)]">
              <Sidebar user={user} />
            </div>
          </details>

          <div className="hidden items-center gap-2 text-sm text-muted lg:flex">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-teal">
              verified_user
            </span>
            RBAC ativo — você vê apenas o que compete ao seu papel
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-navy">{user?.name ?? "Usuário"}</p>
              <p className="text-xs text-muted">
                {roleLabel}
                {user?.departamento ? ` • ${user.departamento}` : ""}
              </p>
            </div>
            <div
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white"
            >
              {(user?.name ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <button
              type="button"
              className="btn-secondary px-3"
              onClick={() => void handleSignOut()}
              aria-label="Encerrar sessão"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                logout
              </span>
              Sair
            </button>
          </div>
        </header>

        {/* Bootstrap S1.2: instalação ainda sem Gestor PRPq. */}
        {user && user.papel !== "admin" && adminExists === false && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-soft bg-amber-soft px-4 py-2 lg:px-8">
            <p className="text-xs text-ink">
              <strong>Instalação sem Gestor PRPq.</strong> Como primeiro usuário autenticado, você pode
              assumir o papel de gestor para configurar a comunidade (bootstrap S1.2).
            </p>
            <button
              type="button"
              className="btn-primary px-3 text-xs"
              onClick={() => void handleClaimAdmin()}
              disabled={claiming}
            >
              {claiming ? "Assumindo…" : "Assumir papel de Gestor PRPq"}
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
