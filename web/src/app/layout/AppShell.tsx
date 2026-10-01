import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X } from 'lucide-react';

import { useCurrentUser, useAuth } from '@/features/auth/AuthProvider';
import { useNotificacoes } from '@/features/notificacoes/api';
import { cn } from '@/shared/lib/cn';
import { iniciais } from '@/shared/lib/format';
import { ROLE_LABEL } from '@/shared/lib/labels';

import { navFor, PUBLIC_NAV } from '../navigation';
import { BrandMark } from './BrandMark';
import { SkipLink } from './SkipLink';

/**
 * Shell autenticado: sidebar fixa de 260px no desktop e gaveta no mobile
 * (DESIGN.md, grid responsivo), topo com notificações e conta.
 */
export function AppShell() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const { data: notificacoes } = useNotificacoes();
  const naoLidas = notificacoes?.data.filter((n) => !n.lida).length ?? 0;

  // Fecha a gaveta ao navegar.
  useEffect(() => setMenuAberto(false), [location.pathname]);

  function sair() {
    logout();
    navigate('/editais');
  }

  const itens = navFor(user.role);

  const sidebar = (
    <div className="flex h-full flex-col bg-primary text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Link to="/inicio" aria-label="Portal PIBIC, início">
          <BrandMark inverted />
        </Link>
        <button
          type="button"
          className="rounded p-1 text-primary-muted hover:text-white lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {itens.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-white text-primary' : 'text-slate-200 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {to === '/notificacoes' && naoLidas > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 text-xs font-bold text-primary tnum">{naoLidas}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-primary-muted">Público</p>
        <ul className="space-y-1">
          {PUBLIC_NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold"
            aria-hidden
          >
            {iniciais(user.nome)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.nome}</p>
            <p className="truncate text-xs text-primary-muted">
              {ROLE_LABEL[user.role]}
              {user.departamento ? `, ${user.departamento}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={sair}
            className="rounded-lg p-2 text-primary-muted transition hover:bg-white/10 hover:text-white"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-[260px]">
      <SkipLink />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] lg:block">{sidebar}</aside>

      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuAberto(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-overlay">{sidebar}</aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <button
          type="button"
          className="rounded-lg p-2 text-ink hover:bg-canvas lg:hidden"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={menuAberto}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="lg:hidden">
          <BrandMark />
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/notificacoes"
            className="relative rounded-lg p-2 text-ink-muted transition hover:bg-canvas hover:text-ink"
            aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
          >
            <Bell className="h-5 w-5" aria-hidden />
            {naoLidas > 0 && (
              <span
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tnum"
                aria-hidden
              >
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </Link>
          <span className="hidden text-sm text-ink-muted sm:inline">
            {user.nome.split(' ')[0]}
          </span>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-layout px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
