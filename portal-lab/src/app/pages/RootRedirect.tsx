import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { HOME_BY_ROLE } from "../layout/nav";
import { FullScreenSpinner } from "../Spinner";

/**
 * Rota `/`: usuário autenticado cai na landing do seu papel (RF03);
 * visitante vai para o login.
 */
export function RootRedirect() {
  const { isLoading, user } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return <FullScreenSpinner label="Carregando portal…" />;
  }
  if (user) {
    return <Navigate to={HOME_BY_ROLE[user.papel] ?? "/login"} replace />;
  }
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
