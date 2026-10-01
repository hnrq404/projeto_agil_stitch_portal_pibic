import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthProvider';
import { CadastroPage } from '@/features/auth/CadastroPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { EditaisPublicosPage } from '@/features/editais/EditaisPublicosPage';
import { LoadingState } from '@/shared/ui/Feedback';

import { GuestOnly, RequireAuth, RequireRole } from './guards';
import { AppShell } from './layout/AppShell';
import { PublicLayout } from './layout/PublicLayout';
import { GESTORES, homeFor } from './navigation';
import { NotFoundPage } from './NotFoundPage';

/**
 * Carrega a página sob demanda (code splitting por rota): o visitante da
 * vitrine não baixa o código do painel do gestor nem do avaliador (RNF01).
 */
function page<M extends Record<string, unknown>>(loader: () => Promise<M>, nome: keyof M & string) {
  return async () => ({ Component: (await loader())[nome] as ComponentType });
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return <Navigate to={user ? homeFor(user.role) : '/editais'} replace />;
}

/**
 * Mapa de rotas. Públicas usam o PublicLayout; as autenticadas, o AppShell.
 * Cada grupo por papel passa pelo RequireRole (o backend valida de novo).
 */
export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: '/cadastro', element: <GuestOnly><CadastroPage /></GuestOnly> },
      { path: '/editais', element: <EditaisPublicosPage /> },
      { path: '/editais/:id', lazy: page(() => import('@/features/editais/EditalPublicoPage'), 'EditalPublicoPage') },
      { path: '/pesquisas', lazy: page(() => import('@/features/vitrine/VitrinePesquisasPage'), 'VitrinePesquisasPage') },
    ],
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: '/inicio', lazy: page(() => import('@/features/dashboard/InicioPage'), 'InicioPage') },
      { path: '/notificacoes', lazy: page(() => import('@/features/notificacoes/NotificacoesPage'), 'NotificacoesPage') },
      // Detalhe da inscrição: dono, orientador, avaliador designado e gestão (o backend decide).
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
        element: <RequireRole roles={['DISCENTE']} />,
        children: [
          { path: '/inscricoes', lazy: page(() => import('@/features/inscricoes/MinhasInscricoesPage'), 'MinhasInscricoesPage') },
          { path: '/inscricoes/nova', lazy: page(() => import('@/features/inscricoes/NovaInscricaoPage'), 'NovaInscricaoPage') },
          { path: '/inscricoes/:id/editar', lazy: page(() => import('@/features/inscricoes/InscricaoWizardPage'), 'InscricaoWizardPage') },
        ],
      },
      {
        element: <RequireRole roles={['DOCENTE']} />,
        children: [{ path: '/orientacoes', lazy: page(() => import('@/features/inscricoes/OrientacoesPage'), 'OrientacoesPage') }],
      },
      {
        element: <RequireRole roles={['AVALIADOR', ...GESTORES]} />,
        children: [
          { path: '/avaliacoes', lazy: page(() => import('@/features/avaliacoes/MinhasAvaliacoesPage'), 'MinhasAvaliacoesPage') },
          { path: '/avaliacoes/:id', lazy: page(() => import('@/features/avaliacoes/AvaliacaoPage'), 'AvaliacaoPage') },
        ],
      },
      {
        element: <RequireRole roles={['DISCENTE', 'DOCENTE', ...GESTORES]} />,
        children: [
          { path: '/projetos', lazy: page(() => import('@/features/projetos/MeusProjetosPage'), 'MeusProjetosPage') },
          { path: '/projetos/:id', lazy: page(() => import('@/features/projetos/ProjetoPage'), 'ProjetoPage') },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
