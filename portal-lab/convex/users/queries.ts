import { getCurrentUser, requireRole, toDto } from "./index";
import { query } from "../_generated/server";

/** Usuário logado — alimenta sidebar, header e guards de rota (S1.3). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    // Não lança: durante o assentamento da sessão o id pode vir nulo e a
    // query não seria reexecutada, travando o frontend no login.
    const user = await getCurrentUser(ctx);
    return user ? toDto(user) : null;
  },
});

const MAX_LIST = 500;

/** Listagem de usuários para a tela de Gestão de Usuários (S1.2, admin). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const users = await ctx.db.query("users").order("desc").take(MAX_LIST);
    return users.map(toDto);
  },
});

/** Fila de homologação: usuários que solicitaram papéis elevados (S1.2). */
export const pendingRoles = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin");
    const all = await ctx.db.query("users").order("desc").take(MAX_LIST);
    return all.filter((u) => (u.papeisSolicitados?.length ?? 0) > 0).map(toDto);
  },
});

/**
 * Indica se a instalação já possui um Gestor PRPq. Usado pelo banner de
 * bootstrap na shell (S1.2): sem nenhum admin, o primeiro usuário autenticado
 * pode assumir o papel para destravar a Gestão de Usuários.
 */
export const adminExists = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const admin = await ctx.db
      .query("users")
      .withIndex("papel", (q) => q.eq("papel", "admin"))
      .first();
    return admin !== null;
  },
});
