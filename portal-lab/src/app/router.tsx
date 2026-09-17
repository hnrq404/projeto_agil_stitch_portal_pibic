import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedPage } from "./ProtectedPage";
import { AuthPage } from "./pages/AuthPage";
import { GestaoUsuariosPage } from "./pages/GestaoUsuariosPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RecuperarSenhaPage } from "./pages/RecuperarSenhaPage";
import { RootRedirect } from "./pages/RootRedirect";
import { MinhasInscricoesPage } from "../features/inscricao/MinhasInscricoesPage";
import { NovaInscricaoPage } from "../features/inscricao/NovaInscricaoPage";
import { InscricaoDetalhePage } from "../features/inscricao/InscricaoDetalhePage";

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  { path: "/login", element: <AuthPage mode="login" /> },
  { path: "/cadastro", element: <AuthPage mode="register" /> },
  { path: "/recuperar-senha", element: <RecuperarSenhaPage /> },
  {
    path: "/gestao-usuarios",
    element: (
      <ProtectedPage perm="gestao-usuarios">
        <GestaoUsuariosPage />
      </ProtectedPage>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedPage perm="dashboard">
        <PlaceholderPage title="Dashboard do Gestor" sprint="S5" />
      </ProtectedPage>
    ),
  },
  {
    path: "/editais",
    element: (
      <ProtectedPage perm="editais">
        <PlaceholderPage title="Editais & Publicação" sprint="S2" />
      </ProtectedPage>
    ),
  },
  {
    path: "/triagem",
    element: (
      <ProtectedPage perm="triagem">
        <PlaceholderPage title="Central de Triagem" sprint="S4" />
      </ProtectedPage>
    ),
  },
  {
    path: "/triagem-orientador",
    element: (
      <ProtectedPage perm="triagem-orientador">
        <PlaceholderPage title="Triagem dos Meus Projetos" sprint="S4" />
      </ProtectedPage>
    ),
  },
  {
    path: "/nova-inscricao",
    element: (
      <ProtectedPage perm="nova-inscricao">
        <NovaInscricaoPage />
      </ProtectedPage>
    ),
  },
  {
    path: "/nova-inscricao/:id",
    element: (
      <ProtectedPage perm="nova-inscricao">
        <NovaInscricaoPage />
      </ProtectedPage>
    ),
  },
  {
    path: "/minhas-inscricoes",
    element: (
      <ProtectedPage perm="minhas-inscricoes">
        <MinhasInscricoesPage />
      </ProtectedPage>
    ),
  },
  {
    path: "/inscricoes/:id",
    element: (
      <ProtectedPage>
        <InscricaoDetalhePage />
      </ProtectedPage>
    ),
  },
  {
    path: "/meus-projetos",
    element: (
      <ProtectedPage perm="meus-projetos">
        <PlaceholderPage title="Meus Projetos" sprint="S5" />
      </ProtectedPage>
    ),
  },
  {
    path: "/minhas-avaliacoes",
    element: (
      <ProtectedPage perm="minhas-avaliacoes">
        <PlaceholderPage title="Minhas Avaliações" sprint="S4" />
      </ProtectedPage>
    ),
  },
  {
    path: "/vitrine",
    element: <PlaceholderPage title="Vitrine Pública" sprint="S6" />,
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
