import { can } from "../../../convex/roles";
import type { UserDto } from "../../../convex/users/index";
import { Link } from "react-router-dom";
import { NAV_ITEMS } from "./nav";

type SidebarProps = {
  user: UserDto | null;
  onNavigate?: () => void;
};

/**
 * S1.3 / RF03: navegação lateral filtrada pelo papel do usuário autenticado
 * (RN11). Itens sem permissão nem aparecem no DOM.
 */
export function Sidebar({ user, onNavigate }: SidebarProps) {
  const items = user ? NAV_ITEMS.filter((item) => can(user.papel, item.perm)) : [];

  return (
    <nav aria-label="Navegação principal" className="flex h-full flex-col gap-1 p-4">
      <a
        className="mb-4 flex items-center gap-2 px-2 py-1"
        href="/"
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
      </a>
      {items.length === 0 ? (
        <p className="px-2 text-sm text-muted">Nenhum item disponível para o seu papel.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-primary-fixed hover:bg-[#e2e7ff] hover:text-ink"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
