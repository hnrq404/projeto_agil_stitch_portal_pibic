import { createBrowserRouter } from "react-router-dom";
import { ProtectedPage } from "./ProtectedPage";
import { AjudaPage } from "./pages/AjudaPage";
import { AuthPage } from "./pages/AuthPage";
import { EditaisAbertosPage } from "./pages/editais/EditaisAbertosPage";
import { EditaisPage } from "./pages/editais/EditaisPage";
import { EditalDetalhePage } from "./pages/editais/EditalDetalhePage";
import { EditalFormPage } from "./pages/editais/EditalFormPage";
import { GestaoUsuariosPage } from "./pages/GestaoUsuariosPage";
import { NotFoundPage } from "./pages/NotFoundPage";
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
  { path: "/ajuda", element: <AjudaPage /> },
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
        <PlaceholderPage title="Dashboard do Gestor" />
      </ProtectedPage>
    ),
  },
  {
    path: "/editais",
    element: (
      <ProtectedPage perm="editais">
        <EditaisPage />
      </ProtectedPage>
    ),
  },
  {
    path: "/editais/novo",
    element: (
      <ProtectedPage perm="editais">
        <EditalFormPage />
      </ProtectedPage>
    ),
  },
  {
    path: "/editais/:id",
    element: (
      <ProtectedPage perm="editais">
        <EditalDetalhePage />
      </ProtectedPage>
    ),
  },
  {
    path: "/editais/:id/editar",
    element: (
      <ProtectedPage perm="editais">
        <EditalFormPage />
      </ProtectedPage>
    ),
  },
  { path: "/editais-abertos", element: <EditaisAbertosPage /> },
  {
    path: "/triagem",
    element: (
      <ProtectedPage perm="triagem">
        <PlaceholderPage title="Central de Triagem" />
      </ProtectedPage>
    ),
  },
  {
    path: "/triagem-orientador",
    element: (
      <ProtectedPage perm="triagem-orientador">
        <PlaceholderPage title="Triagem dos Meus Projetos" />
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
        <PlaceholderPage title="Meus Projetos" />
      </ProtectedPage>
    ),
  },
  {
    path: "/minhas-avaliacoes",
    element: (
      <ProtectedPage perm="minhas-avaliacoes">
        <PlaceholderPage title="Minhas Avaliações" />
      </ProtectedPage>
    ),
  },
  {
    path: "/vitrine",
    element: <PlaceholderPage title="Vitrine Pública" />,
  },
  { path: "*", element: <NotFoundPage /> },
]);
