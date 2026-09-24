import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { UserDto } from "../../../convex/users/index";
import { can, ROLE_LABELS } from "../../../convex/roles";
import { friendlyError } from "../../lib/errors";
import { Alert } from "../ui/Alert";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { HELP_ITEM, NAV_ITEMS, pageMeta } from "./nav";
import { Sidebar } from "./Sidebar";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

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
  const { pathname } = useLocation();
  const roleLabel = user ? ROLE_LABELS[user.papel] : "";
  const adminExists = useQuery(api.users.queries.adminExists);
  const claimBootstrapAdmin = useMutation(api.users.mutations.claimBootstrapAdmin);
  const [claiming, setClaiming] = useState(false);
  const [confirmClaim, setConfirmClaim] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const items = useMemo(
    () => (user ? NAV_ITEMS.filter((item) => can(user.papel, item.perm)) : []),
    [user],
  );
  const navPaths = useMemo(() => items.map((i) => i.to), [items]);
  useKeyboardShortcuts(navPaths);

  // Nielsen #1: a aba do navegador e o cabeçalho dizem onde o usuário está.
  const meta = pageMeta(pathname);
  useEffect(() => {
    document.title = meta ? `${meta.label} · Portal PIBIC` : "Portal PIBIC — Iniciação Científica";
  }, [meta]);

  // Nielsen #3: o menu mobile fecha ao trocar de página ou com Esc.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  async function handleClaimAdmin() {
    if (!user) return;
    setClaiming(true);
    setClaimError(null);
    try {
      await claimBootstrapAdmin({});
      // Recarrega para que queries restritas a admin sejam reavaliadas.
      window.location.reload();
    } catch (err) {
      setClaiming(false);
      setConfirmClaim(false);
      setClaimError(
        friendlyError(err, "Não foi possível assumir a gestão agora. Tente novamente."),
      );
    }
  }

  const pendingRequest = user?.papeisSolicitados?.[0];

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy"
      >
        Pular para o conteúdo
      </a>

      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-hairline bg-card lg:block">
        <Sidebar user={user} items={items} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-hairline bg-card px-4 lg:px-8">
          {/* Drawer mobile (tablet/mobile: 8/4 colunas do DESIGN.md) */}
          <div className="relative lg:hidden">
            <button
              type="button"
              aria-label={menuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
              aria-expanded={menuOpen}
              aria-controls="menu-mobile"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline-strong"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-navy">
                {menuOpen ? "close" : "menu"}
              </span>
            </button>
            {menuOpen && (
              <div
                id="menu-mobile"
                className="absolute left-0 top-12 z-50 w-64 rounded-xl border border-hairline bg-card shadow-[var(--shadow-card-hover)]"
              >
                <Sidebar user={user} items={items} onNavigate={() => setMenuOpen(false)} />
              </div>
            )}
          </div>

          {/* Nielsen #1: "você está aqui" */}
          <nav aria-label="Localização atual" className="hidden min-w-0 flex-1 text-sm lg:block">
            <ol className="flex items-center gap-1 text-muted">
              <li>
                <Link to="/" className="hover:text-ink hover:underline">
                  Início
                </Link>
              </li>
              {meta && (
                <>
                  <li aria-hidden="true" className="material-symbols-outlined text-[16px]">
                    chevron_right
                  </li>
                  <li aria-current="page" className="truncate font-semibold text-navy">
                    {meta.label}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to={HELP_ITEM.to}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-navy"
              aria-label="Abrir Central de Ajuda"
              title="Ajuda (atalho: ?)"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">
                help
              </span>
            </Link>
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
              aria-label="Sair do portal"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                logout
              </span>
              Sair
            </button>
          </div>
        </header>

        {/* Nielsen #1: pedido de perfil elevado continua visível até ser decidido. */}
        {pendingRequest && (
          <div className="border-b border-hairline px-4 py-2 lg:px-8">
            <Alert tone="info">
              Seu pedido de acesso como <strong>{ROLE_LABELS[pendingRequest]}</strong> está
              aguardando aprovação da PRPq. Enquanto isso, você usa o portal como {roleLabel}.
            </Alert>
          </div>
        )}

        {/* Bootstrap S1.2: instalação ainda sem Gestor PRPq. */}
        {user && user.papel !== "admin" && adminExists === false && (
          <div className="flex flex-col gap-2 border-b border-amber-soft bg-amber-soft px-4 py-2 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink">
                <strong>O portal ainda não tem um Gestor PRPq.</strong> Como primeira pessoa a
                entrar, você pode assumir essa função para aprovar os demais cadastros.
              </p>
              <button
                type="button"
                className="btn-primary px-3 text-xs"
                onClick={() => setConfirmClaim(true)}
              >
                Assumir a gestão do portal
              </button>
            </div>
            {claimError && (
              <Alert tone="error" onDismiss={() => setClaimError(null)}>
                {claimError}
              </Alert>
            )}
          </div>
        )}

        <main
          id="conteudo"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 outline-none lg:px-8"
        >
          {meta && (
            <p className="mb-4 flex items-center gap-1 text-xs text-muted">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-teal">
                info
              </span>
              {meta.description}
            </p>
          )}
          {children}
        </main>
      </div>

      <ConfirmDialog
        open={confirmClaim}
        title="Assumir a gestão do portal?"
        confirmLabel="Sim, assumir gestão"
        busy={claiming}
        onConfirm={() => void handleClaimAdmin()}
        onCancel={() => setConfirmClaim(false)}
      >
        Você passará a ver todos os cadastros e poderá aprovar ou alterar o perfil de qualquer
        pessoa. Só faça isso se você for responsável pela PRPq nesta instalação.
      </ConfirmDialog>
    </div>
  );
}
