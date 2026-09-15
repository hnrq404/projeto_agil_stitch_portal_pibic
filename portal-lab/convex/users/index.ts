import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "../roles";
import { ROLE_LABELS } from "../roles";

/**
 * Carrega o usuário autenticado (S1.4). Lança erro claro quando não há
 * sessão válida — use nas functions que exigem login.
 */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sessão expirada. Faça login novamente." });
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Usuário não encontrado." });
  }
  return user;
}

/**
 * Guard de papel (RN11): a autorização é validada sempre no backend,
 * nunca apenas no frontend. Uso: `await requireRole(ctx, "admin")`.
 */
export async function requireRole(ctx: QueryCtx | MutationCtx, ...roles: Role[]): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!roles.includes(user.papel ?? "aluno")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Acesso restrito a: ${roles.map((r) => ROLE_LABELS[r]).join(", ")}.`,
    });
  }
  return user;
}

export async function getCurrentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return ctx.db.get(userId);
}

export type UserDto = {
  _id: Id<"users">;
  name?: string;
  email?: string;
  papel: Role;
  matricula?: string;
  departamento?: string;
  areaCnpq?: string;
  papeisSolicitados?: Role[];
};

export function toDto(user: Doc<"users">): UserDto {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    papel: user.papel ?? "aluno",
    matricula: user.matricula,
    departamento: user.departamento,
    areaCnpq: user.areaCnpq,
    papeisSolicitados: user.papeisSolicitados ?? [],
  };
}
