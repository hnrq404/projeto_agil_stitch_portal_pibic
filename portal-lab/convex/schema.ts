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

  // ── Sprint 2/S3 — Edital (bridge de leitura para as inscrições) ──────────
  // CRUD completo do gestor é entregue na S2/S5; aqui o modelo já reflete o
  // esboço de dados do [[Arquitetura]] §4.
  editais: defineTable({
    numero: v.string(), // ex.: "01/2026"
    titulo: v.string(),
    programa: v.string(), // "PIBIC" | "PIBITI" | "INTERNO"
    status: v.union(
      v.literal("rascunho"),
      v.literal("publicado"),
      v.literal("em_avaliacao"),
      v.literal("encerrado"),
    ),
    dataAbertura: v.number(), // epoch ms
    dataEncerramento: v.number(), // epoch ms
    totalCotas: v.number(),
  }).index("status", ["status"]),

  // ── Sprint 3 — Inscrição de Pesquisa (M3) ────────────────────────────────
  // Estados: rascunho → submetida → em_triagem → avaliada → aprovada/recusada
  // (stateDiagram do [[Arquitetura]] §5). Protocolo único gerado no backend.
  inscricoes: defineTable({
    editalId: v.id("editais"),
    discenteId: v.id("users"),
    orientadorId: v.optional(v.id("users")),
    orientadorStatus: v.optional(
      v.union(v.literal("pendente"), v.literal("aprovado"), v.literal("recusado")),
    ),
    titulo: v.string(),
    areaCnpq: v.string(),
    resumo: v.string(),
    metodologia: v.optional(v.string()),
    cronograma: v.optional(v.string()),
    palavrasChave: v.array(v.string()),
    planoTrabalhoFileId: v.optional(v.id("arquivos")),
    lattesFileId: v.optional(v.id("arquivos")),
    status: v.union(
      v.literal("rascunho"),
      v.literal("submetida"),
      v.literal("em_triagem"),
      v.literal("avaliada"),
      v.literal("aprovada"),
      v.literal("recusada"),
    ),
    protocolo: v.optional(v.string()), // ex.: 23076.014821/2026-11 (JetBrains Mono na UI)
    createdAt: v.number(),
    updatedAt: v.number(),
    submetidoEm: v.optional(v.number()),
  })
    .index("discente", ["discenteId"])
    .index("orientador", ["orientadorId"])
    .index("status", ["status"])
    .index("protocolo", ["protocolo"]),

  // ── Anexos (Convex Storage) — apenas PDF até 10 MB (RN06/RNF09) ──────────
  arquivos: defineTable({
    storageId: v.id("_storage"),
    inscricaoId: v.id("inscricoes"),
    nome: v.string(),
    tamanho: v.number(),
    mimeType: v.string(),
    tipo: v.union(v.literal("plano_trabalho"), v.literal("lattes")),
    enviadoPor: v.id("users"),
    enviadoEm: v.number(),
  }).index("inscricao", ["inscricaoId"]),
});
