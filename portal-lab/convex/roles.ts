import { v } from "convex/values";

export const ROLE = {
  ADMIN: "admin",
  DOCENTE: "docente",
  ALUNO: "aluno",
  AVALIADOR: "avaliador",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLES: readonly Role[] = [ROLE.ADMIN, ROLE.DOCENTE, ROLE.AVALIADOR, ROLE.ALUNO];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Gestor PRPq",
  docente: "Professor Orientador",
  avaliador: "Avaliador",
  aluno: "Aluno (Graduação)",
};

/** Validador Convex reutilizável para o campo `papel`. */
export const roleValidator = v.union(...ROLES.map((r) => v.literal(r)));

/**
 * Permissões por módulo (RN11): o acesso a funcionalidades é determinado
 * exclusivamente pelo papel do usuário. Fonte única de verdade usada tanto
 * nas guards do backend (`requireRole`) quanto no menu lateral.
 */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    "vitrine",
    "editais-abertos",
    "minhas-inscricoes",
    "nova-inscricao",
    "gestao-usuarios",
    "triagem",
    "dashboard",
    "editais",
  ],
  docente: [
    "vitrine",
    "editais-abertos",
    "minhas-inscricoes",
    "nova-inscricao",
    "meus-projetos",
    "triagem-orientador",
  ],
  avaliador: ["vitrine", "editais-abertos", "triagem", "minhas-avaliacoes"],
  aluno: ["vitrine", "editais-abertos", "minhas-inscricoes", "nova-inscricao"],
};

export function can(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
