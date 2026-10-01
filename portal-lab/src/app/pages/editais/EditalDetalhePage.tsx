import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import {
  EDITAL_STATUSES,
  STATUS_LABELS,
  editMode,
  formatData,
  totalCotas,
} from "../../../../convex/editais/rules";
import type { EditalStatus } from "../../../../convex/editais/rules";
import { prazoRelativo } from "../../../lib/dates";
import { friendlyError } from "../../../lib/errors";
import { Alert } from "../../ui/Alert";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { CotaIndicator, StatusBadge } from "../../ui/StatusBadge";

type Acao = "publicar" | "encerrar" | "finalizar" | "excluir";

/** Próxima ação disponível em cada situação, com o texto do diálogo (Nielsen #5). */
const PROXIMA: Partial<
  Record<EditalStatus, { acao: Acao; label: string; titulo: string; texto: string }>
> = {
  rascunho: {
    acao: "publicar",
    label: "Publicar edital",
    titulo: "Publicar este edital?",
    texto:
      "O edital ficará visível para todos, as inscrições abrirão nas datas definidas e toda a comunidade receberá uma notificação. Depois de publicado, só será possível prorrogar o prazo.",
  },
  publicado: {
    acao: "encerrar",
    label: "Encerrar inscrições agora",
    titulo: "Encerrar as inscrições antes do prazo?",
    texto:
      "Ninguém mais poderá se inscrever, mesmo que o prazo ainda não tenha terminado, e o edital passará para “Em análise”. Esta ação não pode ser desfeita.",
  },
  em_avaliacao: {
    acao: "finalizar",
    label: "Finalizar edital",
    titulo: "Finalizar este edital?",
    texto:
      "Use quando a seleção estiver concluída. Um edital finalizado não pode ser reaberto nem alterado.",
  },
};

export function EditalDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const data = useQuery(api.editais.queries.detalhe, { id: id ?? "" });
  const publicar = useMutation(api.editais.mutations.publicar);
  const encerrar = useMutation(api.editais.mutations.encerrarInscricoes);
  const finalizar = useMutation(api.editais.mutations.finalizar);
  const excluir = useMutation(api.editais.mutations.excluirRascunho);

  const [confirmar, setConfirmar] = useState<Acao | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(
    () => {
      const flash = (location.state as { flash?: string } | null)?.flash;
      return flash ? { tone: "success", message: flash } : null;
    },
  );

  if (data === undefined) {
    return (
      <p className="p-6 text-sm text-muted" role="status">
        Carregando edital…
      </p>
    );
  }

  if (data === null) return <EditalNaoEncontrado />;

  const { edital, historico } = data;
  const proxima = PROXIMA[edital.status];
  const mode = editMode(edital.status);
  const cotas = totalCotas(edital.cotasPorArea);

  async function executar(acao: Acao) {
    setBusy(true);
    try {
      if (acao === "publicar") {
        const res = await publicar({ id: edital._id });
        setFeedback({
          tone: "success",
          message: `Edital publicado. ${res.notificados} pessoa(s) foram notificadas.`,
        });
      } else if (acao === "encerrar") {
        await encerrar({ id: edital._id });
        setFeedback({
          tone: "success",
          message: "Inscrições encerradas. O edital está em análise.",
        });
      } else if (acao === "finalizar") {
        await finalizar({ id: edital._id });
        setFeedback({ tone: "success", message: "Edital finalizado." });
      } else {
        await excluir({ id: edital._id });
        navigate("/editais", { replace: true });
        return;
      }
    } catch (err) {
      setFeedback({
        tone: "error",
        message: friendlyError(err, "Não foi possível concluir a ação. Tente novamente."),
      });
    } finally {
      setBusy(false);
      setConfirmar(null);
    }
  }

  const passoAtual = EDITAL_STATUSES.indexOf(edital.status);

  return (
    <section className="flex flex-col gap-6">
      <Link
        to="/editais"
        className="inline-flex items-center gap-1 text-sm text-teal hover:underline"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
          arrow_back
        </span>
        Todos os editais
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-muted">
            {edital.programa} {edital.numero}
          </span>
          <h1 className="font-display text-2xl font-bold text-navy">{edital.titulo}</h1>
          <StatusBadge status={edital.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {mode !== "bloqueado" && (
            <Link to={`/editais/${edital._id}/editar`} className="btn-secondary px-4">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                edit
              </span>
              {mode === "somente-prazo" ? "Prorrogar prazo" : "Editar"}
            </Link>
          )}
          {proxima && (
            <button
              type="button"
              className="btn-primary px-4"
              onClick={() => setConfirmar(proxima.acao)}
            >
              {proxima.label}
            </button>
          )}
        </div>
      </header>

      {feedback && (
        <Alert tone={feedback.tone} onDismiss={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {/* Nielsen #1: em que ponto do ciclo de vida o edital está. */}
      <ol aria-label="Etapas do edital" className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {EDITAL_STATUSES.map((s, i) => {
          const feito = i < passoAtual;
          const atual = i === passoAtual;
          return (
            <li
              key={s}
              aria-current={atual ? "step" : undefined}
              className={`flex items-center gap-2 text-xs ${atual ? "font-bold text-navy" : feito ? "text-teal" : "text-muted"}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  feito
                    ? "border-teal bg-teal text-white"
                    : atual
                      ? "border-2 border-navy text-navy"
                      : "border-hairline-strong"
                }`}
              >
                {feito ? (
                  <span className="material-symbols-outlined text-[14px]">check</span>
                ) : (
                  i + 1
                )}
              </span>
              {STATUS_LABELS[s]}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card flex flex-col gap-4 p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-navy">Bolsas por área</h2>
          <ul className="flex flex-col divide-y divide-hairline">
            {edital.cotasPorArea.map((c) => (
              <li key={c.area} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm text-ink">{c.area}</span>
                <CotaIndicator ocupadas={c.ocupadas} total={c.total} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Total do edital: <strong className="text-ink">{cotas.total}</strong> bolsas. A ocupação
            é atualizada conforme as inscrições forem aprovadas.
          </p>
        </div>

        <div className="card flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-bold text-navy">Prazos</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Inscrições abrem em</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatData(edital.dataAbertura)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Inscrições encerram em</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatData(edital.dataEncerramento)}, 23h59
                {edital.status === "publicado" && (
                  <span className="ml-1 text-xs font-semibold text-amber">
                    ({prazoRelativo(edital.dataEncerramento)})
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {edital.status === "rascunho" && (
            <button
              type="button"
              className="mt-auto self-start text-xs font-semibold text-status-bad hover:underline"
              onClick={() => setConfirmar("excluir")}
            >
              Excluir rascunho
            </button>
          )}
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-5">
        <h2 className="font-display text-lg font-bold text-navy">Histórico de alterações</h2>
        <ol className="flex flex-col divide-y divide-hairline">
          {historico.map((h) => (
            <li
              key={h._id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-xs"
            >
              <span className="text-ink">
                <strong>{h.acao}</strong>
                {h.detalhe ? `: ${h.detalhe}` : ""}
              </span>
              <span className="text-muted">
                {h.autor} em{" "}
                {new Date(h.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <ConfirmDialog
        open={confirmar !== null}
        title={
          confirmar === "excluir"
            ? "Excluir este rascunho?"
            : (Object.values(PROXIMA).find((p) => p.acao === confirmar)?.titulo ?? "")
        }
        confirmLabel={
          confirmar === "excluir"
            ? "Excluir rascunho"
            : (Object.values(PROXIMA).find((p) => p.acao === confirmar)?.label ?? "Confirmar")
        }
        busy={busy}
        onConfirm={() => confirmar && void executar(confirmar)}
        onCancel={() => setConfirmar(null)}
      >
        {confirmar === "excluir"
          ? "O rascunho e o histórico dele serão apagados. Como ele nunca foi publicado, ninguém além da gestão o viu."
          : Object.values(PROXIMA).find((p) => p.acao === confirmar)?.texto}
      </ConfirmDialog>
    </section>
  );
}

/** Nielsen #9: link antigo ou edital excluído. */
export function EditalNaoEncontrado() {
  return (
    <section className="card flex flex-col items-start gap-3 p-6">
      <h1 className="font-display text-xl font-bold text-navy">Edital não encontrado</h1>
      <p className="text-sm text-muted">
        Este edital não existe mais. Ele pode ter sido um rascunho excluído, ou o link está
        incompleto.
      </p>
      <Link to="/editais" className="btn-secondary px-4">
        Ver todos os editais
      </Link>
    </section>
  );
}
