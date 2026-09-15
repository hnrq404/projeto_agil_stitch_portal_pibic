import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { roleValidator } from "./roles";

// Tabelas de auth (users, authSessions, authAccounts) vêm do @convex-dev/auth;
// a tabela `users` é redefinida aqui para carregar o perfil institucional.
export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    // Campos institucionais do portal (Página 06 — Controle de Acesso)
    papel: v.optional(roleValidator),
    matricula: v.optional(v.string()), // matrícula discente ou SIAPE docente
    departamento: v.optional(v.string()), // unidade/centro acadêmico
    areaCnpq: v.optional(v.string()), // grande área CNPq
    papeisSolicitados: v.optional(v.array(roleValidator)), // fila de homologação da PRPq
  })
    .index("email", ["email"])
    .index("papel", ["papel"]),
});
