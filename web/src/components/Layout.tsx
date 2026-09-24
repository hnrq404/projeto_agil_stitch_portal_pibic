import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

/**
 * Layout global — header sempre presente com estado de autenticação:
 * - deslogado: botões "Entrar" e "Cadastrar";
 * - logado: nome do usuário, "Minhas notificações" e "Sair".
 */
export function Layout({ children }: { children: ReactNode }) {
  const { user, isGestor, logout } = useAuth();
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  function handleLogout() {
    logout();
    navigate('/editais');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/editais" className="flex items-center gap-2 text-lg font-bold text-brand-700">
            <span aria-hidden>🔬</span> Portal PIBIC
          </Link>

          <nav className="ml-4 flex items-center gap-1">
            <NavLink to="/editais" className={navLinkClass} end>
              Vitrine de Editais
            </NavLink>
            {isGestor && (
              <NavLink to="/gestor/editais" className={navLinkClass}>
                Área do Gestor
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/notificacoes"
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  🔔 Notificações
                </Link>
                <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                  {user.nome} <span className="text-slate-400">({user.role})</span>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Entrar
                </Link>
                <Link
                  to="/cadastro"
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        Portal PIBIC — Sprint 2 · Edital & Publicação
      </footer>
    </div>
  );
}
