import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthProvider';
import { EditaisPublicosPage } from '@/features/editais/EditaisPublicosPage';
import { LoadingState } from '@/shared/ui/Feedback';

import { GuestOnly, RequireAuth, RequireRole } from './guards';
import { AppShell } from './layout/AppShell';
import { PublicLayout } from './layout/PublicLayout';
import { GESTORES, homeFor } from './navigation';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';

/**
 * Carrega a página sob demanda (code splitting por rota): o visitante da
 * vitrine não baixa o código do painel do gestor nem do avaliador (RNF01).
 */
function page<M extends Record<string, unknown>>(loader: () => Promise<M>, nome: keyof M & string) {
  return async () => ({ Component: (await loader())[nome] as ComponentType });
}

/** Como `page`, mas só para visitantes (login/cadastro): o formulário e o Zod saem do bundle inicial. */
function guestPage<M extends Record<string, unknown>>(loader: () => Promise<M>, nome: keyof M & string) {
  return async () => {
    const Pagina = (await loader())[nome] as ComponentType;
    return {
      element: (
        <GuestOnly>
          <Pagina />
        </GuestOnly>
      ),
    };
  };
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return <Navigate to={user ? homeFor(user.role) : '/editais'} replace />;
}

/** Endereço inexistente: dentro do AppShell para quem está logado, no layout público para visitantes. */
function NotFoundLayout() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return user ? <AppShell /> : <PublicLayout />;
}

/**
 * Mapa de rotas. Públicas usam o PublicLayout; as autenticadas, o AppShell.
 * Cada grupo por papel passa pelo RequireRole (o backend valida de novo).
 * O errorElement da raiz pega qualquer falha; os de dentro dos layouts mantêm
 * o menu na tela quando só a página quebra.
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <RootRedirect /> },
      {
        element: <PublicLayout />,
        children: [
          {
            errorElement: <RouteErrorPage />,
            children: [
              { path: '/login', lazy: guestPage(() => import('@/features/auth/LoginPage'), 'LoginPage') },
              { path: '/cadastro', lazy: guestPage(() => import('@/features/auth/CadastroPage'), 'CadastroPage') },
              { path: '/esqueci-senha', lazy: guestPage(() => import('@/features/auth/EsqueciSenhaPage'), 'EsqueciSenhaPage') },
              // Destinos dos links enviados por e-mail: abrem com ou sem sessão.
              { path: '/verificar-email', lazy: page(() => import('@/features/auth/VerificarEmailPage'), 'VerificarEmailPage') },
              { path: '/redefinir-senha', lazy: page(() => import('@/features/auth/RedefinirSenhaPage'), 'RedefinirSenhaPage') },
              { path: '/editais', element: <EditaisPublicosPage /> },
              { path: '/editais/:id', lazy: page(() => import('@/features/editais/EditalPublicoPage'), 'EditalPublicoPage') },
              { path: '/pesquisas', lazy: page(() => import('@/features/vitrine/VitrinePesquisasPage'), 'VitrinePesquisasPage') },
              // Projetos divulgados pelos professores: o aluno logado se candidata na própria página.
              { path: '/oportunidades', lazy: page(() => import('@/features/candidaturas/OportunidadesPage'), 'OportunidadesPage') },
            ],
          },
        ],
      },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          {
            errorElement: <RouteErrorPage />,
            children: [
              { path: '/inicio', lazy: page(() => import('@/features/dashboard/InicioPage'), 'InicioPage') },
              { path: '/notificacoes', lazy: page(() => import('@/features/notificacoes/NotificacoesPage'), 'NotificacoesPage') },
              { path: '/perfil', lazy: page(() => import('@/features/perfil/PerfilPage'), 'PerfilPage') },
              // Detalhe do projeto: professor dono, aluno selecionado, avaliador indicado e gestão (o backend decide).
              { path: '/inscricoes/:id', lazy: page(() => import('@/features/inscricoes/InscricaoDetalhePage'), 'InscricaoDetalhePage') },
              {
                element: <RequireRole roles={GESTORES} />,
                children: [
                  { path: '/gestor/editais', lazy: page(() => import('@/features/editais/GestorEditaisPage'), 'GestorEditaisPage') },
                  { path: '/gestor/editais/novo', lazy: page(() => import('@/features/editais/EditalFormPage'), 'EditalFormPage') },
                  { path: '/gestor/editais/:id', lazy: page(() => import('@/features/editais/EditalGestorPage'), 'EditalGestorPage') },
                  { path: '/gestor/editais/:id/editar', lazy: page(() => import('@/features/editais/EditalFormPage'), 'EditalFormPage') },
                  { path: '/triagem', lazy: page(() => import('@/features/triagem/TriagemPage'), 'TriagemPage') },
                  { path: '/triagem/ranking/:editalId', lazy: page(() => import('@/features/triagem/RankingPage'), 'RankingPage') },
                  { path: '/triagem/:id', lazy: page(() => import('@/features/triagem/TriagemDetalhePage'), 'TriagemDetalhePage') },
                  { path: '/usuarios', lazy: page(() => import('@/features/usuarios/GestaoUsuariosPage'), 'GestaoUsuariosPage') },
                ],
              },
              {
                // Professor: escreve, divulga, seleciona o aluno, envia ao edital e avalia projetos de colegas.
                element: <RequireRole roles={['DOCENTE']} />,
                children: [
                  { path: '/inscricoes', lazy: page(() => import('@/features/inscricoes/MinhasInscricoesPage'), 'MinhasInscricoesPage') },
                  { path: '/inscricoes/nova', lazy: page(() => import('@/features/inscricoes/NovaInscricaoPage'), 'NovaInscricaoPage') },
                  { path: '/inscricoes/:id/editar', lazy: page(() => import('@/features/inscricoes/InscricaoWizardPage'), 'InscricaoWizardPage') },
                  { path: '/avaliacoes', lazy: page(() => import('@/features/avaliacoes/MinhasAvaliacoesPage'), 'MinhasAvaliacoesPage') },
                  { path: '/avaliacoes/:id', lazy: page(() => import('@/features/avaliacoes/AvaliacaoPage'), 'AvaliacaoPage') },
                ],
              },
              {
                element: <RequireRole roles={['DISCENTE']} />,
                children: [
                  { path: '/candidaturas', lazy: page(() => import('@/features/candidaturas/MinhasCandidaturasPage'), 'MinhasCandidaturasPage') },
                ],
              },
              {
                element: <RequireRole roles={['DISCENTE', 'DOCENTE', ...GESTORES]} />,
                children: [
                  { path: '/projetos', lazy: page(() => import('@/features/projetos/MeusProjetosPage'), 'MeusProjetosPage') },
                  { path: '/projetos/:id', lazy: page(() => import('@/features/projetos/ProjetoPage'), 'ProjetoPage') },
                ],
              },
            ],
          },
        ],
      },
      // Fora do RequireAuth: visitante em URL inexistente vê o 404, não a tela de login.
      {
        element: <NotFoundLayout />,
        children: [{ path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
]);
