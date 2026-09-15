export type NavItem = {
  to: string;
  label: string;
  icon: string;
  perm: string;
};

/** Itens da shell (S1.3): exibidos somente se `can(papel, perm)` (RF03/RN11). */
export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "space_dashboard", perm: "dashboard" },
  { to: "/editais", label: "Editais", icon: "description", perm: "editais" },
  { to: "/triagem", label: "Central de Triagem", icon: "fact_check", perm: "triagem" },
  { to: "/nova-inscricao", label: "Nova Inscrição", icon: "edit_note", perm: "nova-inscricao" },
  { to: "/minhas-inscricoes", label: "Minhas Inscrições", icon: "folder_open", perm: "minhas-inscricoes" },
  { to: "/meus-projetos", label: "Meus Projetos", icon: "science", perm: "meus-projetos" },
  { to: "/minhas-avaliacoes", label: "Minhas Avaliações", icon: "rate_review", perm: "minhas-avaliacoes" },
  { to: "/triagem-orientador", label: "Triagem dos Meus Projetos", icon: "how_to_reg", perm: "triagem-orientador" },
  { to: "/gestao-usuarios", label: "Gestão de Usuários", icon: "manage_accounts", perm: "gestao-usuarios" },
  { to: "/vitrine", label: "Vitrine Pública", icon: "public", perm: "vitrine" },
];

/** Rota inicial por papel (landing pós-login). */
export const HOME_BY_ROLE: Record<string, string> = {
  admin: "/dashboard",
  avaliador: "/triagem",
  docente: "/meus-projetos",
  aluno: "/minhas-inscricoes",
};
