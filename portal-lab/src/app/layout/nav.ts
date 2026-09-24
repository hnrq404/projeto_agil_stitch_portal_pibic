export type NavItem = {
  to: string;
  label: string;
  icon: string;
  perm: string;
  /** Explicação curta exibida no cabeçalho da página (Nielsen #6/#10). */
  description: string;
};

/** Itens da shell (S1.3): exibidos somente se `can(papel, perm)` (RF03/RN11). */
export const NAV_ITEMS: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: "space_dashboard",
    perm: "dashboard",
    description: "Números do edital: inscrições, cotas preenchidas e andamento das avaliações.",
  },
  {
    to: "/editais",
    label: "Editais",
    icon: "description",
    perm: "editais",
    description: "Crie, publique e encerre editais de iniciação científica.",
  },
  {
    to: "/triagem",
    label: "Central de Triagem",
    icon: "fact_check",
    perm: "triagem",
    description: "Distribua e avalie as propostas recebidas no edital.",
  },
  {
    to: "/nova-inscricao",
    label: "Nova Inscrição",
    icon: "edit_note",
    perm: "nova-inscricao",
    description: "Envie uma proposta de pesquisa para o edital aberto.",
  },
  {
    to: "/minhas-inscricoes",
    label: "Minhas Inscrições",
    icon: "folder_open",
    perm: "minhas-inscricoes",
    description: "Acompanhe a situação das propostas que você enviou.",
  },
  {
    to: "/meus-projetos",
    label: "Meus Projetos",
    icon: "science",
    perm: "meus-projetos",
    description: "Projetos que você orienta e os alunos vinculados a eles.",
  },
  {
    to: "/minhas-avaliacoes",
    label: "Minhas Avaliações",
    icon: "rate_review",
    perm: "minhas-avaliacoes",
    description: "Propostas atribuídas a você para dar parecer.",
  },
  {
    to: "/triagem-orientador",
    label: "Triagem dos Meus Projetos",
    icon: "how_to_reg",
    perm: "triagem-orientador",
    description: "Confirme os alunos que se inscreveram nos seus projetos.",
  },
  {
    to: "/gestao-usuarios",
    label: "Gestão de Usuários",
    icon: "manage_accounts",
    perm: "gestao-usuarios",
    description: "Aprove pedidos de acesso e ajuste o perfil de cada pessoa.",
  },
  {
    to: "/vitrine",
    label: "Vitrine Pública",
    icon: "public",
    perm: "vitrine",
    description: "Pesquisas aprovadas, abertas para consulta de qualquer pessoa.",
  },
];

export const HELP_ITEM = {
  to: "/ajuda",
  label: "Central de Ajuda",
  icon: "help",
  description: "Passo a passo das tarefas mais comuns, atalhos e contato do suporte.",
} as const;

/** Título/descrição da página atual para o cabeçalho e a aba do navegador (Nielsen #1). */
export function pageMeta(pathname: string): { label: string; description: string } | null {
  if (pathname.startsWith(HELP_ITEM.to)) return HELP_ITEM;
  return NAV_ITEMS.find((item) => pathname.startsWith(item.to)) ?? null;
}

/** Rota inicial por papel (landing pós-login). */
export const HOME_BY_ROLE: Record<string, string> = {
  admin: "/dashboard",
  avaliador: "/triagem",
  docente: "/meus-projetos",
  aluno: "/minhas-inscricoes",
};
