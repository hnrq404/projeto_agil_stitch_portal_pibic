import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { cotaValidator, programaValidator, statusValidator } from "./editais/rules";
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

  // M2 — Edital & Publicação (S2)
  editais: defineTable({
    numero: v.string(), // "003/2026", gerado no backend
    ano: v.number(),
    titulo: v.string(),
    programa: programaValidator,
    status: statusValidator,
    dataAbertura: v.number(), // epoch ms
    dataEncerramento: v.number(), // epoch ms
    cotasPorArea: v.array(cotaValidator),
    criadoPor: v.id("users"),
  })
    .index("status", ["status"])
    .index("ano", ["ano"]),

  // RN03: toda alteração em edital fica registrada.
  editalHistorico: defineTable({
    editalId: v.id("editais"),
    autorId: v.optional(v.id("users")), // ausente = ação automática do sistema
    acao: v.string(),
    detalhe: v.optional(v.string()),
  }).index("edital", ["editalId"]),

  // Notificações in-app (S2: "edital publicado").
  notificacoes: defineTable({
    userId: v.id("users"),
    titulo: v.string(),
    mensagem: v.string(),
    link: v.optional(v.string()),
    lida: v.boolean(),
  }).index("user_lida", ["userId", "lida"]),
});
