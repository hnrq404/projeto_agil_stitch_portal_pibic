import type { ReactNode } from "react";
import { RequireAuth, RequireRole } from "./guards";
import { AppShell } from "./layout/AppShell";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FullScreenSpinner } from "./Spinner";

type ProtectedPageProps = {
  /** Permissão RBAC exigida (RN11); omitir para páginas só com login. */
  perm?: string;
  children: ReactNode;
};

/**
 * Combina os dois guards (S1.3/S1.4): exige sessão válida e, quando a página
 * declara uma permissão, exige o papel correspondente — e envolve tudo na
 * shell com sidebar adaptada ao papel (RF03).
 */
export function ProtectedPage({ perm, children }: ProtectedPageProps) {
  const { isLoading, isAuthenticated, user } = useCurrentUser();

  if (isLoading) {
    return <FullScreenSpinner label="Verificando sessão…" />;
  }

  return (
    <RequireAuth>
      {user === null ? (
        <FullScreenSpinner label="Carregando perfil…" />
      ) : (
        <AppShell user={user}>
          {perm ? <RequireRole perm={perm}>{children}</RequireRole> : children}
        </AppShell>
      )}
      {isAuthenticated ? null : null}
    </RequireAuth>
  );
}
