import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { can, ROLE_LABELS } from "../../convex/roles";
import { useCurrentUser } from "../hooks/useCurrentUser";
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

/** Tela de acesso negado (403) com instrução clara em pt-BR. */
function ForbiddenScreen({ perm, roleLabel }: { perm: string; roleLabel: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[48px] text-status-bad">
        gpp_bad
      </span>
      <h1 className="text-2xl font-bold text-navy">Acesso restrito</h1>
      <p className="max-w-md text-sm text-muted">
        Seu papel ({roleLabel}) não possui a permissão{" "}
        <code className="font-mono text-xs text-ink">{perm}</code> conforme a matriz RBAC (RN11).
        Procure a PRPq caso acredite que isso seja um erro.
      </p>
      <a className="btn-secondary px-4" href="/">
        Voltar ao início
      </a>
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
        perm={perm}
        roleLabel={user ? ROLE_LABELS[user.papel] : "não autenticado"}
      />
    );
  }
  return <>{children}</>;
}
