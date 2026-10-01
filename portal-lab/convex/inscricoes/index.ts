import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireRole, requireUser, toDto } from "../users/index";
import { gerarProtocolo } from "./protocolo";
import { editalEncerrado, pendenciasSubmissao, validarAnexo } from "./regras";

/**
 * Sprint 3 — Inscrição de Pesquisa (M3).
 * Backend é a fonte de verdade: autorização em toda function (RN11),
 * anexos validados no servidor (RN06/RNF09) e protocolo único gerado aqui.
 */

export type InscricaoDto = {
  _id: Id<"inscricoes">;
  editalId: Id<"editais">;
  discenteId: Id<"users">;
  orientadorId?: Id<"users">;
  orientadorStatus?: "pendente" | "aprovado" | "recusado";
  titulo: string;
  areaCnpq: string;
  resumo: string;
  metodologia?: string;
  cronograma?: string;
  palavrasChave: string[];
  planoTrabalhoFileId?: Id<"arquivos">;
  lattesFileId?: Id<"arquivos">;
  status:
    | "rascunho"
    | "submetida"
    | "em_triagem"
    | "avaliada"
    | "aprovada"
    | "recusada";
  protocolo?: string;
  createdAt: number;
  updatedAt: number;
  submetidoEm?: number;
};

export type ArquivoDto = {
  _id: Id<"arquivos">;
  storageId: Id<"_storage">;
  inscricaoId: Id<"inscricoes">;
  nome: string;
  tamanho: number;
  mimeType: string;
  tipo: "plano_trabalho" | "lattes";
  enviadoEm: number;
};

export function toInscricaoDto(inscricao: Doc<"inscricoes">): InscricaoDto {
  return {
    _id: inscricao._id,
    editalId: inscricao.editalId,
    discenteId: inscricao.discenteId,
    orientadorId: inscricao.orientadorId,
    orientadorStatus: inscricao.orientadorStatus,
    titulo: inscricao.titulo,
    areaCnpq: inscricao.areaCnpq,
    resumo: inscricao.resumo,
    metodologia: inscricao.metodologia,
    cronograma: inscricao.cronograma,
    palavrasChave: inscricao.palavrasChave,
    planoTrabalhoFileId: inscricao.planoTrabalhoFileId,
    lattesFileId: inscricao.lattesFileId,
    status: inscricao.status,
    protocolo: inscricao.protocolo,
    createdAt: inscricao.createdAt,
    updatedAt: inscricao.updatedAt,
    submetidoEm: inscricao.submetidoEm,
  };
}

function toArquivoDto(arquivo: Doc<"arquivos">): ArquivoDto {
  return {
    _id: arquivo._id,
    storageId: arquivo.storageId,
    inscricaoId: arquivo.inscricaoId,
    nome: arquivo.nome,
    tamanho: arquivo.tamanho,
    mimeType: arquivo.mimeType,
    tipo: arquivo.tipo,
    enviadoEm: arquivo.enviadoEm,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/** Editais com inscrições abertas (S2.4/S3): apenas `publicado` e vigente. */
export const listEditaisPublicados = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const agora = Date.now();
    const editais = await ctx.db
      .query("editais")
      .withIndex("status", (q) => q.eq("status", "publicado"))
      .collect();
    return editais
      .filter((e) => e.dataAbertura <= agora && agora <= e.dataEncerramento)
      .map((e) => ({ ...e }));
  },
});

/** Inscrições do discente autenticado (S3.4 — lista "Minhas Inscrições"). */
export const listMinhas = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const inscricoes = await ctx.db
      .query("inscricoes")
      .withIndex("discente", (q) => q.eq("discenteId", user._id))
      .collect();
    return inscricoes
      .map(toInscricaoDto)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Inscrições em que o docente autenticado é orientador (painel do docente). */
export const listOrientacao = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const inscricoes = await ctx.db
      .query("inscricoes")
      .withIndex("orientador", (q) => q.eq("orientadorId", user._id))
      .collect();
    return inscricoes
      .map(toInscricaoDto)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Detalhe de uma inscrição (S3.4). Acesso restrito ao discente dono, ao
 * orientador vinculado e ao gestor (RN11 — autorização validada no backend).
 */
export const get = query({
  args: { id: v.id("inscricoes") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const inscricao = await ctx.db.get(id);
    if (!inscricao) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Inscrição não encontrada." });
    }
    const autorizado =
      inscricao.discenteId === user._id ||
      inscricao.orientadorId === user._id ||
      user.papel === "admin";
    // Sem vazamento de existência: acesso negado é indistinguível de
    // inexistente (resposta `null` em vez de erro, cf. revisão S3).
    if (!autorizado) {
      return null;
    }
    const edital = await ctx.db.get(inscricao.editalId);
    const discente = await ctx.db.get(inscricao.discenteId);
    const orientador = inscricao.orientadorId
      ? await ctx.db.get(inscricao.orientadorId)
      : null;
    const anexos = await ctx.db
      .query("arquivos")
      .withIndex("inscricao", (q) => q.eq("inscricaoId", inscricao._id))
      .collect();
    return {
      inscricao: toInscricaoDto(inscricao),
      edital: edital ? { ...edital } : null,
      discente: discente ? toDto(discente) : null,
      orientador: orientador ? toDto(orientador) : null,
      arquivos: anexos.map(toArquivoDto),
    };
  },
});

/** URL de download de um anexo (acesso só para quem vê a inscrição). */
export const urlDownload = query({
  args: { arquivoId: v.id("arquivos") },
  handler: async (ctx, { arquivoId }) => {
    const user = await requireUser(ctx);
    const arquivo = await ctx.db.get(arquivoId);
    if (!arquivo) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Anexo não encontrado." });
    }
    const inscricao = await ctx.db.get(arquivo.inscricaoId);
    const autorizado =
      inscricao !== null &&
      (inscricao.discenteId === user._id ||
        inscricao.orientadorId === user._id ||
        user.papel === "admin");
    if (!autorizado) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Acesso negado ao anexo." });
    }
    return await ctx.storage.getUrl(arquivo.storageId);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Cria a inscrição em rascunho (S3.1) e devolve o id para o formulário. */
export const criarRascunho = mutation({
  args: { editalId: v.id("editais") },
  handler: async (ctx, { editalId }) => {
    const user = await requireUser(ctx);
    const edital = await ctx.db.get(editalId);
    if (!edital) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Edital não encontrado." });
    }
    // RN02 — prazo: exige edital publicado e dentro do período de inscrições.
    if (editalEncerrado(edital, Date.now())) {
      throw new ConvexError({
        code: "DEADLINE",
        message: "Este edital não está com inscrições abertas (fora do prazo ou encerrado).",
      });
    }
    const agora = Date.now();
    const id = await ctx.db.insert("inscricoes", {
      editalId,
      discenteId: user._id,
      titulo: "",
      areaCnpq: "",
      resumo: "",
      palavrasChave: [],
      status: "rascunho",
      createdAt: agora,
      updatedAt: agora,
    });
    return { id };
  },
});

/** Dados parciais do rascunho — auto-save (S3.5 / RNF08). */
const RascunhoPatch = v.object({
  titulo: v.optional(v.string()),
  areaCnpq: v.optional(v.string()),
  resumo: v.optional(v.string()),
  metodologia: v.optional(v.string()),
  cronograma: v.optional(v.string()),
  palavrasChave: v.optional(v.array(v.string())),
  orientadorId: v.optional(v.id("users")),
});

/**
 * Salva o rascunho (auto-save). Regras: apenas o discente dono edita
 * (RN05); ao trocar o orientador, a carta-aceite volta a `pendente`.
 */
export const salvarRascunho = mutation({
  args: { id: v.id("inscricoes"), dados: RascunhoPatch },
  handler: async (ctx, { id, dados }) => {
    const user = await requireUser(ctx);
    const inscricao = await ctx.db.get(id);
    if (!inscricao) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Inscrição não encontrada." });
    }
    if (inscricao.discenteId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Apenas o discente dono edita o rascunho." });
    }
    if (inscricao.status !== "rascunho") {
      throw new ConvexError({
        code: "INVALID",
        message: "Inscrição submetida é somente-leitura (RN05).",
      });
    }
    // Vínculo de orientação só com docente real (evita vínculo pendente
    // eterno apontando para aluno ou auto-vínculo).
    if (dados.orientadorId !== undefined) {
      const docente = await ctx.db.get(dados.orientadorId);
      if (!docente || (docente.papel ?? "aluno") !== "docente") {
        throw new ConvexError({
          code: "INVALID",
          message: "Orientador informado não é um Professor Orientador ativo.",
        });
      }
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [campo, valor] of Object.entries(dados)) {
      if (valor !== undefined) {
        patch[campo] = valor;
      }
    }
    if (
      dados.orientadorId !== undefined &&
      dados.orientadorId !== inscricao.orientadorId
    ) {
      patch.orientadorStatus = "pendente";
    }
    await ctx.db.patch(id, patch);
    return { ok: true, updatedAt: patch.updatedAt as number };
  },
});

/** Gera URL de upload direto para o Convex Storage (S3.2). */
export const gerarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Registra o anexo após o upload ao storage (S3.2). Valida PDF ≤ 10 MB no
 * backend (RN06/RNF09) e vincula o arquivo à inscrição do discente.
 */
export const registrarAnexo = mutation({
  args: {
    inscricaoId: v.id("inscricoes"),
    storageId: v.id("_storage"),
    nome: v.string(),
    mimeType: v.string(),
    tamanho: v.number(),
    tipo: v.union(v.literal("plano_trabalho"), v.literal("lattes")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const inscricao = await ctx.db.get(args.inscricaoId);
    if (!inscricao) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Inscrição não encontrada." });
    }
    if (inscricao.discenteId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Apenas o discente dono anexa arquivos." });
    }
    if (inscricao.status !== "rascunho") {
      throw new ConvexError({
        code: "INVALID",
        message: "Inscrição submetida é somente-leitura (RN05).",
      });
    }
    const erro = validarAnexo({ nome: args.nome, mimeType: args.mimeType, tamanho: args.tamanho });
    if (erro) {
      throw new ConvexError({ code: "INVALID", message: erro });
    }
    // Substituição: remove do storage e do banco o anexo anterior do mesmo
    // tipo antes de vincular o novo (evita órfãos e duplicidade na listagem).
    const anteriorId =
      args.tipo === "plano_trabalho"
        ? inscricao.planoTrabalhoFileId
        : inscricao.lattesFileId;
    if (anteriorId) {
      const anterior = await ctx.db.get(anteriorId);
      if (anterior) {
        await ctx.storage.delete(anterior.storageId);
        await ctx.db.delete(anterior._id);
      }
    }
    const agora = Date.now();
    const arquivoId = await ctx.db.insert("arquivos", {
      storageId: args.storageId,
      inscricaoId: args.inscricaoId,
      nome: args.nome,
      tamanho: args.tamanho,
      mimeType: args.mimeType,
      tipo: args.tipo,
      enviadoPor: user._id,
      enviadoEm: agora,
    });
    const patch: Record<string, unknown> = { updatedAt: agora };
    if (args.tipo === "plano_trabalho") {
      patch.planoTrabalhoFileId = arquivoId;
    } else {
      patch.lattesFileId = arquivoId;
    }
    await ctx.db.patch(args.inscricaoId, patch);
    return { arquivoId };
  },
});

/** Remove um anexo do rascunho (arquivo + metadado). */
export const removerAnexo = mutation({
  args: { arquivoId: v.id("arquivos") },
  handler: async (ctx, { arquivoId }) => {
    const user = await requireUser(ctx);
    const arquivo = await ctx.db.get(arquivoId);
    if (!arquivo) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Anexo não encontrado." });
    }
    const inscricao = await ctx.db.get(arquivo.inscricaoId);
    if (!inscricao || inscricao.discenteId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Apenas o discente dono remove anexos." });
    }
    if (inscricao.status !== "rascunho") {
      throw new ConvexError({ code: "INVALID", message: "Inscrição submetida é somente-leitura (RN05)." });
    }
    await ctx.storage.delete(arquivo.storageId);
    await ctx.db.delete(arquivoId);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (inscricao.planoTrabalhoFileId === arquivoId) patch.planoTrabalhoFileId = undefined;
    if (inscricao.lattesFileId === arquivoId) patch.lattesFileId = undefined;
    await ctx.db.patch(inscricao._id, patch);
    return { ok: true };
  },
});

/**
 * Submissão final (S3.3): exige proposta completa (orientador aprovado +
 * plano de trabalho), gera o protocolo único no backend e torna a inscrição
 * somente-leitura (RN05).
 */
export const submeter = mutation({
  args: { id: v.id("inscricoes") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const inscricao = await ctx.db.get(id);
    if (!inscricao) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Inscrição não encontrada." });
    }
    if (inscricao.discenteId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Apenas o discente dono submete a inscrição." });
    }
    if (inscricao.status !== "rascunho") {
      throw new ConvexError({ code: "INVALID", message: "Inscrição já submetida (RN05)." });
    }
    // RN02 — submissão exige edital dentro do prazo: rascunho criado antes
    // do encerramento não pode ser enviado depois.
    const edital = await ctx.db.get(inscricao.editalId);
    if (!edital || editalEncerrado(edital, Date.now())) {
      throw new ConvexError({
        code: "DEADLINE",
        message: "Prazo de submissão do edital encerrado (RN02).",
      });
    }
    const pendencias = pendenciasSubmissao({
      titulo: inscricao.titulo,
      areaCnpq: inscricao.areaCnpq,
      resumo: inscricao.resumo,
      metodologia: inscricao.metodologia,
      cronograma: inscricao.cronograma,
      palavrasChave: inscricao.palavrasChave,
      orientadorId: inscricao.orientadorId,
      orientadorStatus: inscricao.orientadorStatus,
      planoTrabalhoFileId: inscricao.planoTrabalhoFileId,
    });
    if (pendencias.length > 0) {
      throw new ConvexError({
        code: "INCOMPLETE",
        message: `Inscrição incompleta: ${pendencias.join(" ")}`,
        pendencias,
      });
    }
    // Protocolo único gerado no backend, com verificação de colisão.
    let protocolo = gerarProtocolo(Date.now());
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const existente = await ctx.db
        .query("inscricoes")
        .withIndex("protocolo", (q) => q.eq("protocolo", protocolo))
        .first();
      if (!existente) break;
      protocolo = gerarProtocolo(Date.now());
    }
    const agora = Date.now();
    await ctx.db.patch(id, {
      status: "submetida",
      protocolo,
      submetidoEm: agora,
      updatedAt: agora,
    });
    return { ok: true, protocolo };
  },
});

/**
 * Carta-aceite do orientador (S3): o docente vinculado aprova ou recusa o
 * vínculo. Aprovar destrava a submissão pelo discente.
 */
export const aprovarVinculo = mutation({
  args: { id: v.id("inscricoes"), aprovar: v.boolean() },
  handler: async (ctx, { id, aprovar }) => {
    const user = await requireRole(ctx, "docente", "admin");
    const inscricao = await ctx.db.get(id);
    if (!inscricao) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Inscrição não encontrada." });
    }
    if (inscricao.orientadorId !== user._id && user.papel !== "admin") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Somente o orientador solicitado responde ao vínculo.",
      });
    }
    if (inscricao.status !== "rascunho") {
      throw new ConvexError({
        code: "INVALID",
        message: "Vínculo só pode ser respondido enquanto a inscrição estiver em rascunho.",
      });
    }
    await ctx.db.patch(id, {
      orientadorStatus: aprovar ? "aprovado" : "recusado",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Seed de demonstração (idempotente): cria um edital PIBIC publicado para
 * exercitar o fluxo de inscrição localmente, sem depender da S2 (CRUD do
 * gestor). Não duplica quando já existe edital publicado.
 */
export const seedEditalDemo = mutation({
  args: {},
  handler: async (ctx) => {
    // Escrita em `editais` é exclusiva do gestor (RN11). Sem isso, o seed de
    // demonstração vira vazamento quando a S2 entregar o CRUD do gestor.
    const gestor = await requireRole(ctx, "admin");
    const existente = await ctx.db
      .query("editais")
      .withIndex("status", (q) => q.eq("status", "publicado"))
      .first();
    if (existente) {
      return { editalId: existente._id, criado: false };
    }
    const agora = Date.now();
    const editalId = await ctx.db.insert("editais", {
      numero: "001/2026",
      titulo: "PIBIC 2026–2027 — Programa Institucional de Bolsas de Iniciação Científica",
      programa: "PIBIC",
      status: "publicado",
      dataAbertura: agora - 7 * 24 * 60 * 60 * 1000,
      dataEncerramento: agora + 45 * 24 * 60 * 60 * 1000,
      // Formato da S2 (cotas por área CNPq).
      ano: new Date(agora).getFullYear(),
      cotasPorArea: [
        { area: "Ciências Exatas e da Terra", total: 8, ocupadas: 0 },
        { area: "Engenharias", total: 7, ocupadas: 0 },
        { area: "Ciências Biológicas", total: 5, ocupadas: 0 },
      ],
      criadoPor: gestor._id,
    });
    return { editalId, criado: true };
  },
});
