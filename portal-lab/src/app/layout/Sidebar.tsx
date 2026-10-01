import { Link, NavLink } from "react-router-dom";
import type { UserDto } from "../../../convex/users/index";
import { HELP_ITEM, type NavItem } from "./nav";

type SidebarProps = {
  user: UserDto | null;
  /** Itens já filtrados pelo papel (RF03/RN11) — calculados uma vez na shell. */
  items: NavItem[];
  onNavigate?: () => void;
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-[#e2e7ff] text-navy shadow-[inset_3px_0_0_var(--color-navy)]"
      : "text-muted hover:bg-[#e2e7ff] hover:text-ink"
  }`;

/**
 * S1.3 / RF03: navegação lateral filtrada pelo papel do usuário autenticado
 * (RN11). Itens sem permissão nem aparecem no DOM. O item da página atual
 * fica destacado e marcado com aria-current (Nielsen #1 — "você está aqui").
 */
export function Sidebar({ user, items, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col gap-1 p-4">
      <Link
        className="mb-4 flex items-center gap-2 px-2 py-1"
        to="/"
        onClick={onNavigate}
        aria-label="Página inicial do Portal PIBIC"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy font-display text-sm font-bold text-white"
        >
          P
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-display text-sm font-bold text-navy">Portal PIBIC</span>
          <span className="text-[11px] text-muted">Iniciação Científica</span>
        </span>
      </Link>
      {user && items.length === 0 ? (
        <p className="px-2 text-sm text-muted">
          Seu perfil ainda não tem áreas liberadas. Se você pediu acesso de docente ou avaliador,
          aguarde a aprovação da PRPq.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={linkClass}
                title={i < 9 ? `${item.description} (atalho: Alt + ${i + 1})` : item.description}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto border-t border-hairline pt-3">
        <NavLink to={HELP_ITEM.to} onClick={onNavigate} className={linkClass} title="Atalho: ?">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
            {HELP_ITEM.icon}
          </span>
          {HELP_ITEM.label}
        </NavLink>
      </div>
    </nav>
  );
}
