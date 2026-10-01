import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser, requireUser } from "./users/index";

/** Notificações do usuário logado: não lidas primeiro, até 20 no total. */
export const minhas = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { naoLidas: 0, itens: [] };
    const naoLidas = await ctx.db
      .query("notificacoes")
      .withIndex("user_lida", (q) => q.eq("userId", user._id).eq("lida", false))
      .order("desc")
      .take(20);
    const lidas = await ctx.db
      .query("notificacoes")
      .withIndex("user_lida", (q) => q.eq("userId", user._id).eq("lida", true))
      .order("desc")
      .take(Math.max(0, 20 - naoLidas.length));
    return {
      naoLidas: naoLidas.length,
      itens: [...naoLidas, ...lidas].map((n) => ({
        _id: n._id,
        em: n._creationTime,
        titulo: n.titulo,
        mensagem: n.mensagem,
        link: n.link,
        lida: n.lida,
      })),
    };
  },
});

export const marcarLida = mutation({
  args: { id: v.id("notificacoes") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const n = await ctx.db.get(id);
    if (n && n.userId === user._id && !n.lida) await ctx.db.patch(id, { lida: true });
  },
});

export const marcarTodasLidas = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const naoLidas = await ctx.db
      .query("notificacoes")
      .withIndex("user_lida", (q) => q.eq("userId", user._id).eq("lida", false))
      .collect();
    for (const n of naoLidas) await ctx.db.patch(n._id, { lida: true });
  },
});
