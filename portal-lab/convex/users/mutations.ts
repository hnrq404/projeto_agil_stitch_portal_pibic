import { ConvexError, v } from "convex/values";
import { requireRole, requireUser } from "./index";
import { mutation } from "../_generated/server";
import { roleValidator } from "../roles";

/**
 * Altera o papel de um usuário (S1.2, RF02). Exclusivo do admin/Gestor PRPq.
 * A nova permissão vale imediatamente porque toda query/mutation revalida
 * o papel no backend (RN11) e o frontend recebe o update reativo (RNF07).
 */
export const setRole = mutation({
  args: {
    userId: v.id("users"),
    papel: roleValidator,
    /** Usado pelo "Desfazer" da tela de gestão para restaurar a fila (Nielsen #3). */
    papeisSolicitados: v.optional(v.array(roleValidator)),
  },
  handler: async (ctx, { userId, papel, papeisSolicitados }) => {
    await requireRole(ctx, "admin");
    const target = await ctx.db.get(userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    }
    await ctx.db.patch(userId, { papel, papeisSolicitados: papeisSolicitados ?? [] });
    return { ok: true };
  },
});

/**
 * Homologa o papel solicitado na fila (S1.2). Exclusivo do admin.
 */
export const grantRequestedRole = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireRole(ctx, "admin");
    const target = await ctx.db.get(userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    }
    const [papel] = target.papeisSolicitados ?? [];
    if (!papel) {
      throw new ConvexError({
        code: "INVALID",
        message: "Usuário não possui solicitação pendente.",
      });
    }
    await ctx.db.patch(userId, { papel, papeisSolicitados: [] });
    return { ok: true, papel };
  },
});

/**
 * Bootstrap do primeiro gestor (S1.2): quando a instalação ainda não tem
 * nenhum admin, o primeiro usuário autenticado assume o papel de Gestor
 * PRPq. Depois disso a tela de Gestão de Usuários controla os papéis.
 */
export const claimBootstrapAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.papel === "admin") {
      return { claimed: false };
    }
    const admins = await ctx.db
      .query("users")
      .withIndex("papel", (q) => q.eq("papel", "admin"))
      .first();
    if (admins) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "A instalação já possui um Gestor PRPq. Use a Gestão de Usuários para solicitar papel elevado.",
      });
    }
    await ctx.db.patch(user._id, { papel: "admin", papeisSolicitados: [] });
    return { claimed: true };
  },
});
