import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

import { useAuth } from '@/features/auth/AuthProvider';
import type { UserRole } from '@/shared/types/api';
import { ButtonLink } from '@/shared/ui/Button';
import { EmptyState, LoadingState } from '@/shared/ui/Feedback';

import { homeFor } from './navigation';

/** RN12: rota protegida sem sessão vai ao login, guardando o destino para voltar depois. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Verificando sua sessão..." />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return children ?? <Outlet />;
}

/** RN11: só o papel permitido entra; os demais veem uma explicação e um caminho de volta. */
export function RequireRole({ roles, children }: { roles: readonly UserRole[]; children?: ReactNode }) {
  const { user } = useAuth();
  if (user && !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Acesso restrito"
        description="Esta área não está disponível para o seu perfil. Se precisar de acesso, fale com a gestão do programa."
        action={<ButtonLink to={homeFor(user.role)}>Voltar ao início</ButtonLink>}
      />
    );
  }
  return children ?? <Outlet />;
}

/**
 * Telas de login/cadastro: quem já está logado segue para o destino que tentou
 * abrir (guardado pelo RequireAuth) ou para a sua página inicial.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    // Só caminhos internos: barra "//host" e "/\host" (open redirect do react-router < 7.18).
    const destinoSeguro = typeof from === 'string' && /^\/(?![/\\])/.test(from) ? from : undefined;
    return <Navigate to={destinoSeguro ?? homeFor(user.role)} replace />;
  }
  return children;
}
