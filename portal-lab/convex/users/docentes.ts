import { toDto } from "./index";
import { requireRole } from "./index";
import { query } from "../_generated/server";

/**
 * Docentes disponíveis para orientação (S3): lista enxuta para o select do
 * formulário multi-etapas. Exclusivo de usuários autenticados.
 */
export const listDocentes = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "admin", "docente", "aluno");
    const docentes = await ctx.db
      .query("users")
      .withIndex("papel", (q) => q.eq("papel", "docente"))
      .collect();
    return docentes
      .map(toDto)
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"));
  },
});
