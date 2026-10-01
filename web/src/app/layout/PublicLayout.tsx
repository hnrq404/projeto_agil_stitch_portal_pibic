import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/shared/lib/cn';
import { ButtonLink } from '@/shared/ui/Button';

import { homeFor, PUBLIC_NAV } from '../navigation';
import { BrandMark } from './BrandMark';
import { SkipLink } from './SkipLink';

/** Páginas abertas (vitrines, login, cadastro): cabeçalho simples e rodapé institucional. */
export function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-layout flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/editais" aria-label="Portal PIBIC, página inicial">
            <BrandMark />
          </Link>
          <nav aria-label="Navegação pública" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
            {PUBLIC_NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-canvas hover:text-ink',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <ButtonLink to={homeFor(user.role)} size="sm">
                {user.role === 'USUARIO' ? 'Minha conta' : 'Ir para o painel'}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/login" variant="secondary" size="sm">
                  Entrar
                </ButtonLink>
                <ButtonLink to="/cadastro" size="sm">
                  Criar conta
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-layout flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-layout flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-ink-subtle sm:px-6 lg:px-8">
          <p>Programa Institucional de Bolsas de Iniciação Científica</p>
          <p>CNPq, Pró-Reitoria de Pesquisa</p>
        </div>
      </footer>
    </div>
  );
}
