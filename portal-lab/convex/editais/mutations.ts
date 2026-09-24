import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { requireRole } from "../users/index";
import {
  canTransition,
  cotasDoEdital,
  cotaValidator,
  editMode,
  formatData,
  formatNumero,
  programaValidator,
  shouldAutoClose,
  STATUS_LABELS,
  validateEdital,
} from "./rules";
import type { EditalStatus } from "./rules";

const MAX_NOTIFY = 500;

const editalFields = {
  titulo: v.string(),
  programa: programaValidator,
  dataAbertura: v.number(),
  dataEncerramento: v.number(),
  cotasPorArea: v.array(cotaValidator),
};

/** RN03: toda alteração em edital fica registrada em histórico. */
async function registrar(
  ctx: MutationCtx,
  editalId: Id<"editais">,
  autorId: Id<"users"> | undefined,
  acao: string,
  detalhe?: string,
) {
  await ctx.db.insert("editalHistorico", { editalId, autorId, acao, detalhe });
}

async function loadEdital(ctx: MutationCtx, id: Id<"editais">): Promise<Doc<"editais">> {
  const edital = await ctx.db.get(id);
  if (!edital) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Edital não encontrado. Ele pode ter sido excluído.",
    });
  }
  return edital;
}

function assertValid(input: Parameters<typeof validateEdital>[0]) {
  const errors = validateEdital(input);
  const messages = Object.values(errors);
  if (messages.length > 0) {
    throw new ConvexError({ code: "INVALID", message: messages.join(" ") });
  }
}

/** S2.1 / RF05 — cria o edital como rascunho, com número sequencial por ano. */
export const criar = mutation({
  args: editalFields,
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "admin");
    // Cotas começam vazias: a ocupação vem das inscrições aprovadas (S3/S5).
    const cotasPorArea = args.cotasPorArea.map((c) => ({ ...c, ocupadas: 0 }));
    const input = { ...args, titulo: args.titulo.trim(), cotasPorArea };
    assertValid(input);

    const ano = new Date(args.dataAbertura).getFullYear();
    const doAno = await ctx.db
      .query("editais")
      .withIndex("ano", (q) => q.eq("ano", ano))
      .collect();
    const numero = formatNumero(doAno.length + 1, ano);

    const id = await ctx.db.insert("editais", {
      ...input,
      numero,
      ano,
      status: "rascunho",
      criadoPor: user._id,
    });
    await registrar(ctx, id, user._id, "Edital criado como rascunho");
    return { id, numero };
  },
});

/** S2.2 / RF06 — edição respeitando RN02 (após publicar, só prorrogar prazo). */
export const atualizar = mutation({
  args: { id: v.id("editais"), ...editalFields },
  handler: async (ctx, { id, ...args }) => {
    const user = await requireRole(ctx, "admin");
    const edital = await loadEdital(ctx, id);
    const mode = editMode(edital.status);

    if (mode === "bloqueado") {
      throw new ConvexError({
        code: "INVALID",
        message: `Editais "${STATUS_LABELS[edital.status]}" não podem mais ser alterados.`,
      });
    }

    if (mode === "somente-prazo") {
      const outrosCamposMudaram =
        args.titulo.trim() !== edital.titulo ||
        args.programa !== edital.programa ||
        args.dataAbertura !== edital.dataAbertura ||
        JSON.stringify(args.cotasPorArea.map((c) => [c.area, c.total])) !==
          JSON.stringify(cotasDoEdital(edital).map((c) => [c.area, c.total]));
      if (outrosCamposMudaram) {
        throw new ConvexError({
          code: "INVALID",
          message: "Com as inscrições abertas, só é possível prorrogar o prazo de encerramento.",
        });
      }
      if (args.dataEncerramento <= edital.dataEncerramento) {
        throw new ConvexError({
          code: "INVALID",
          message: "A nova data de encerramento precisa ser depois da atual (apenas prorrogação).",
        });
      }
      await ctx.db.patch(id, { dataEncerramento: args.dataEncerramento });
      await registrar(
        ctx,
        id,
        user._id,
        "Prazo prorrogado",
        `${formatData(edital.dataEncerramento)} para ${formatData(args.dataEncerramento)}`,
      );
      return { ok: true };
    }

    // Mantém a ocupação atual de cada área.
    const cotasPorArea = args.cotasPorArea.map((c) => ({
      ...c,
      ocupadas: cotasDoEdital(edital).find((o) => o.area === c.area)?.ocupadas ?? 0,
    }));
    const input = { ...args, titulo: args.titulo.trim(), cotasPorArea };
    assertValid(input);

    const mudou: string[] = [];
    if (input.titulo !== edital.titulo) mudou.push("título");
    if (input.programa !== edital.programa) mudou.push("programa");
    if (
      input.dataAbertura !== edital.dataAbertura ||
      input.dataEncerramento !== edital.dataEncerramento
    ) {
      mudou.push("datas");
    }
    if (JSON.stringify(cotasPorArea) !== JSON.stringify(cotasDoEdital(edital))) mudou.push("cotas");
    if (mudou.length === 0) return { ok: true };

    await ctx.db.patch(id, input);
    await registrar(ctx, id, user._id, "Dados alterados", mudou.join(", "));
    return { ok: true };
  },
});

async function transitar(
  ctx: MutationCtx,
  id: Id<"editais">,
  to: EditalStatus,
  acao: string,
): Promise<{ edital: Doc<"editais">; userId: Id<"users"> }> {
  const user = await requireRole(ctx, "admin");
  const edital = await loadEdital(ctx, id);
  if (!canTransition(edital.status, to)) {
    throw new ConvexError({
      code: "INVALID",
      message: `Não é possível passar um edital de "${STATUS_LABELS[edital.status]}" para "${STATUS_LABELS[to]}".`,
    });
  }
  await ctx.db.patch(id, { status: to });
  await registrar(ctx, id, user._id, acao);
  return { edital, userId: user._id };
}

/** S2.3 — rascunho para publicado; avisa toda a comunidade (notificação in-app). */
export const publicar = mutation({
  args: { id: v.id("editais") },
  handler: async (ctx, { id }) => {
    const atual = await loadEdital(ctx, id);
    assertValid({ ...atual, cotasPorArea: cotasDoEdital(atual) });
    if (atual.dataEncerramento <= Date.now()) {
      throw new ConvexError({
        code: "INVALID",
        message: "O prazo de encerramento já passou. Ajuste as datas antes de publicar.",
      });
    }
    const { edital } = await transitar(ctx, id, "publicado", "Edital publicado");

    const users = await ctx.db.query("users").take(MAX_NOTIFY);
    for (const u of users) {
      await ctx.db.insert("notificacoes", {
        userId: u._id,
        titulo: "Novo edital publicado",
        mensagem: `${edital.programa} ${edital.numero}: ${edital.titulo}. Inscrições até ${formatData(edital.dataEncerramento)}.`,
        link: "/editais-abertos",
        lida: false,
      });
    }
    return { ok: true, notificados: users.length };
  },
});

/** S2.3 — encerra as inscrições manualmente (publicado para em análise). */
export const encerrarInscricoes = mutation({
  args: { id: v.id("editais") },
  handler: async (ctx, { id }) => {
    await transitar(ctx, id, "em_avaliacao", "Inscrições encerradas manualmente");
    return { ok: true };
  },
});

/** S2.3 / RN01 — finaliza o edital; não há como reabrir depois. */
export const finalizar = mutation({
  args: { id: v.id("editais") },
  handler: async (ctx, { id }) => {
    await transitar(ctx, id, "encerrado", "Edital finalizado");
    return { ok: true };
  },
});

/** Exclui um rascunho que nunca foi publicado (Nielsen #3: saída para erros). */
export const excluirRascunho = mutation({
  args: { id: v.id("editais") },
  handler: async (ctx, { id }) => {
    await requireRole(ctx, "admin");
    const edital = await loadEdital(ctx, id);
    if (edital.status !== "rascunho") {
      throw new ConvexError({
        code: "INVALID",
        message:
          "Só é possível excluir editais em rascunho. Editais publicados ficam no histórico.",
      });
    }
    const historico = await ctx.db
      .query("editalHistorico")
      .withIndex("edital", (q) => q.eq("editalId", id))
      .collect();
    for (const h of historico) await ctx.db.delete(h._id);
    await ctx.db.delete(id);
    return { ok: true };
  },
});

/** S2.3 — transição automática por data, executada pelo cron (crons.ts). */
export const fecharVencidos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const publicados = await ctx.db
      .query("editais")
      .withIndex("status", (q) => q.eq("status", "publicado"))
      .collect();
    let fechados = 0;
    for (const e of publicados) {
      if (shouldAutoClose(e.status, e.dataEncerramento, now)) {
        await ctx.db.patch(e._id, { status: "em_avaliacao" });
        await registrar(
          ctx,
          e._id,
          undefined,
          "Inscrições encerradas automaticamente (prazo atingido)",
        );
        fechados++;
      }
    }
    return { fechados };
  },
});
