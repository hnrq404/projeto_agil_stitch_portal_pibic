import type { ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { can, ROLE_LABELS } from "../../convex/roles";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { NAV_ITEMS } from "./layout/nav";
import { FullScreenSpinner } from "./Spinner";

/**
 * S1.4 / RN12: acesso não autenticado a rota protegida redireciona para o
 * login; a sessão expirada força novo login.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useCurrentUser();
  const location = useLocation();
  if (isLoading) {
    return <FullScreenSpinner label="Verificando sessão…" />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/**
 * Tela de acesso negado (403) em linguagem do usuário (Nielsen #2/#9): diz o
 * que aconteceu, por quê e oferece saídas — voltar ou ir ao início (#3).
 */
function ForbiddenScreen({ pageLabel, roleLabel }: { pageLabel: string; roleLabel: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[48px] text-status-bad">
        gpp_bad
      </span>
      <h1 className="text-2xl font-bold text-navy">
        Esta área não está disponível para o seu perfil
      </h1>
      <p className="max-w-md text-sm text-muted">
        <strong>{pageLabel}</strong> é usada por outros perfis do portal. Você entrou como{" "}
        <strong>{roleLabel}</strong>. Se precisa desse acesso, peça à PRPq pelo e-mail{" "}
        <span className="font-mono text-xs text-ink">pibic.suporte@prpq.universidade.br</span>.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-secondary px-4" onClick={() => navigate(-1)}>
          Voltar
        </button>
        <Link className="btn-primary px-4" to="/">
          Ir para minha página inicial
        </Link>
      </div>
    </div>
  );
}

/**
 * S1.3 / RN11: bloqueia a rota quando o papel do usuário autenticado não
 * possui a permissão exigida. O backend reforça a mesma regra em toda
 * function (requireRole) — esta tela é apenas a face amigável.
 */
export function RequireRole({ perm, children }: { perm: string; children: ReactNode }) {
  const { isLoading, user } = useCurrentUser();
  if (isLoading) {
    return <FullScreenSpinner label="Carregando…" />;
  }
  if (!user || !can(user.papel, perm)) {
    return (
      <ForbiddenScreen
        pageLabel={NAV_ITEMS.find((i) => i.perm === perm)?.label ?? "Esta página"}
        roleLabel={user ? ROLE_LABELS[user.papel] : "não autenticado"}
      />
    );
  }
  return <>{children}</>;
}
