import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { AppShell } from "./layout/AppShell";
import { FullScreenSpinner } from "./Spinner";

/**
 * Páginas públicas (ajuda, editais abertos): logado, aparecem dentro da
 * shell com menu; visitante, em layout simples com saída para a entrada.
 */
export function PublicOrShell({
  loadingLabel,
  children,
}: {
  loadingLabel: string;
  children: ReactNode;
}) {
  const { isLoading, user } = useCurrentUser();
  if (isLoading) return <FullScreenSpinner label={loadingLabel} />;
  if (user) return <AppShell user={user}>{children}</AppShell>;
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-8">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1 text-sm text-teal hover:underline"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Voltar para a entrada
        </Link>
        {children}
      </main>
    </div>
  );
}
