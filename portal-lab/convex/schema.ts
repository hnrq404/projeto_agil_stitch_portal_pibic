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
  // Substitui a tabela "ponte" criada na S3. Os campos opcionais existem para
  // aceitar os editais já gravados pelo seed da S3 (só com `totalCotas`);
  // use `cotasDoEdital()` para ler as cotas de qualquer edital.
  editais: defineTable({
    numero: v.string(), // "003/2026", gerado no backend
    ano: v.optional(v.number()),
    titulo: v.string(),
    programa: programaValidator,
    status: statusValidator,
    dataAbertura: v.number(), // epoch ms
    dataEncerramento: v.number(), // epoch ms
    cotasPorArea: v.optional(v.array(cotaValidator)),
    totalCotas: v.optional(v.number()), // legado S3
    criadoPor: v.optional(v.id("users")),
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
