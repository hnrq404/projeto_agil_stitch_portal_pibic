import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireRole } from "../users/index";
import { cotasDoEdital, isPublic } from "./rules";
import type { Cota } from "./rules";

export type EditalDto = Omit<Doc<"editais">, "criadoPor" | "totalCotas" | "cotasPorArea"> & {
  cotasPorArea: Cota[];
};

function toDto(edital: Doc<"editais">): EditalDto {
  const { criadoPor: _criadoPor, totalCotas: _totalCotas, ...rest } = edital;
  return { ...rest, cotasPorArea: cotasDoEdital(edital) };
}

/** Lista completa para o gestor (todas as situações). */
export const listar = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const editais = await ctx.db.query("editais").order("desc").take(200);
    return editais.map(toDto);
  },
});

/** Detalhe + histórico de auditoria (RN03) para o gestor. */
export const detalhe = query({
  // string (e não v.id) porque o valor vem da URL e pode estar malformado.
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");
    const id = ctx.db.normalizeId("editais", args.id);
    const edital = id ? await ctx.db.get(id) : null;
    // null (e não erro) para a tela explicar o problema em vez de quebrar.
    if (!id || !edital) return null;
    const historico = await ctx.db
      .query("editalHistorico")
      .withIndex("edital", (q) => q.eq("editalId", id))
      .order("desc")
      .take(100);
    const autores = new Map<string, string>();
    for (const h of historico) {
      if (h.autorId && !autores.has(h.autorId)) {
        const autor = await ctx.db.get(h.autorId);
        autores.set(h.autorId, autor?.name ?? autor?.email ?? "Usuário removido");
      }
    }
    return {
      edital: toDto(edital),
      historico: historico.map((h) => ({
        _id: h._id,
        em: h._creationTime,
        acao: h.acao,
        detalhe: h.detalhe,
        autor: h.autorId ? (autores.get(h.autorId) ?? "Usuário removido") : "Sistema",
      })),
    };
  },
});

/** S2.4 / RF08 / RN04 — lista pública, sem login: só inscrições abertas ou em análise. */
export const listarPublicos = query({
  args: {},
  handler: async (ctx) => {
    const [abertos, emAnalise] = await Promise.all([
      ctx.db
        .query("editais")
        .withIndex("status", (q) => q.eq("status", "publicado"))
        .collect(),
      ctx.db
        .query("editais")
        .withIndex("status", (q) => q.eq("status", "em_avaliacao"))
        .collect(),
    ]);
    return [...abertos, ...emAnalise]
      .filter((e) => isPublic(e.status))
      .sort((a, b) => a.dataEncerramento - b.dataEncerramento)
      .map(toDto);
  },
});
