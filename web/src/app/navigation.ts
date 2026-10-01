import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  ClipboardCheck,
  FileText,
  FolderKanban,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Microscope,
  UserCog,
  Users,
} from 'lucide-react';

import type { UserRole } from '@/shared/types/api';

export const GESTORES: UserRole[] = ['GESTOR', 'ADMIN'];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: readonly UserRole[] | 'todos';
}

/**
 * Menu lateral por papel (RF03/RN11). É só conveniência de navegação: cada
 * rota também é protegida pelo guard e, de fato, pelo backend.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/inicio', label: 'Início', icon: LayoutDashboard, roles: 'todos' },
  { to: '/gestor/editais', label: 'Editais', icon: FileText, roles: GESTORES },
  { to: '/triagem', label: 'Central de Triagem', icon: ClipboardCheck, roles: GESTORES },
  { to: '/usuarios', label: 'Usuários', icon: UserCog, roles: GESTORES },
  { to: '/inscricoes', label: 'Minhas Inscrições', icon: FolderOpen, roles: ['DISCENTE'] },
  { to: '/orientacoes', label: 'Orientações', icon: Users, roles: ['DOCENTE'] },
  { to: '/avaliacoes', label: 'Minhas Avaliações', icon: GraduationCap, roles: ['AVALIADOR'] },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban, roles: ['DISCENTE', 'DOCENTE', 'GESTOR', 'ADMIN'] },
  { to: '/notificacoes', label: 'Notificações', icon: Bell, roles: 'todos' },
];

export const PUBLIC_NAV: readonly { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/editais', label: 'Editais abertos', icon: Megaphone },
  { to: '/pesquisas', label: 'Vitrine de pesquisas', icon: Microscope },
];

export function navFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'todos' || item.roles.includes(role));
}

/** Página inicial após o login. Visitantes vão direto à vitrine de editais. */
export function homeFor(role: UserRole): string {
  return role === 'USUARIO' ? '/editais' : '/inicio';
}
