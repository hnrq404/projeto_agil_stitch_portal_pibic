import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { CadastroPage } from './pages/CadastroPage';
import { VitrinePage } from './pages/VitrinePage';
import { EditalPublicoPage } from './pages/EditalPublicoPage';
import { GestorEditaisPage } from './pages/GestorEditaisPage';
import { EditalFormPage } from './pages/EditalFormPage';
import { EditalDetalhePage } from './pages/EditalDetalhePage';
import { NotificacoesPage } from './pages/NotificacoesPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Guard: exige login. Visitante não-logado vai para /login. */
function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

/** Guard: exige role GESTOR. Autenticado sem papel cai na vitrine. */
function RequireGestor({ children }: { children: JSX.Element }) {
  const { user, loading, isGestor } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!isGestor) return <Navigate to="/editais" replace />;
  return children;
}

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
      Carregando…
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/editais" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />

        {/* Vitrine pública — aberta a qualquer pessoa */}
        <Route path="/editais" element={<VitrinePage />} />
        <Route path="/editais/:id" element={<EditalPublicoPage />} />

        {/* Área do gestor — protegida por role */}
        <Route
          path="/gestor/editais"
          element={
            <RequireGestor>
              <GestorEditaisPage />
            </RequireGestor>
          }
        />
        <Route
          path="/gestor/editais/novo"
          element={
            <RequireGestor>
              <EditalFormPage />
            </RequireGestor>
          }
        />
        <Route
          path="/gestor/editais/:id/editar"
          element={
            <RequireGestor>
              <EditalFormPage />
            </RequireGestor>
          }
        />
        <Route
          path="/gestor/editais/:id"
          element={
            <RequireGestor>
              <EditalDetalhePage />
            </RequireGestor>
          }
        />

        <Route
          path="/notificacoes"
          element={
            <RequireAuth>
              <NotificacoesPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
