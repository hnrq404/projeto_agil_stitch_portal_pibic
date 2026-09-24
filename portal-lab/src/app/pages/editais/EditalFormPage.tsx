import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../convex/_generated/api";
import { AREAS_CNPQ } from "../../../../convex/areas";
import { editMode, formatData, PROGRAMAS, validateEdital } from "../../../../convex/editais/rules";
import type { EditalErrors, EditMode, Programa } from "../../../../convex/editais/rules";
import type { EditalDto } from "../../../../convex/editais/queries";
import { fromInputDate, toInputDate } from "../../../lib/dates";
import { friendlyError } from "../../../lib/errors";
import { Alert } from "../../ui/Alert";
import { EditalNaoEncontrado } from "./EditalDetalhePage";
import { ConfirmDialog } from "../../ui/ConfirmDialog";

type CotaForm = { area: string; total: string };

type FormState = {
  titulo: string;
  programa: Programa;
  abertura: string;
  encerramento: string;
  cotas: CotaForm[];
};

const PROGRAMA_HINT: Record<Programa, string> = {
  PIBIC: "Iniciação científica (CNPq)",
  PIBITI: "Desenvolvimento tecnológico e inovação (CNPq)",
  INTERNO: "Bolsas da própria universidade",
};

function fromEdital(e: EditalDto): FormState {
  return {
    titulo: e.titulo,
    programa: e.programa,
    abertura: toInputDate(e.dataAbertura),
    encerramento: toInputDate(e.dataEncerramento),
    cotas: e.cotasPorArea.map((c) => ({ area: c.area, total: String(c.total) })),
  };
}

const VAZIO: FormState = {
  titulo: "",
  programa: "PIBIC",
  abertura: "",
  encerramento: "",
  cotas: [{ area: AREAS_CNPQ[0], total: "" }],
};

/** /editais/novo e /editais/:id/editar */
export function EditalFormPage() {
  const { id } = useParams<{ id: string }>();
  const detalhe = useQuery(api.editais.queries.detalhe, id ? { id } : "skip");

  if (id && detalhe === undefined) {
    return (
      <p className="p-6 text-sm text-muted" role="status">
        Carregando edital…
      </p>
    );
  }
  if (id && detalhe === null) return <EditalNaoEncontrado />;
  const edital = detalhe?.edital;
  // `key` reinicia o formulário se o edital mudar de situação enquanto está aberto.
  return <EditalForm key={edital ? `${edital._id}-${edital.status}` : "novo"} edital={edital} />;
}

function EditalForm({ edital }: { edital?: EditalDto }) {
  const navigate = useNavigate();
  const criar = useMutation(api.editais.mutations.criar);
  const atualizar = useMutation(api.editais.mutations.atualizar);

  const mode: EditMode = edital ? editMode(edital.status) : "completo";
  const inicial = useRef(edital ? fromEdital(edital) : VAZIO);
  const [form, setForm] = useState<FormState>(inicial.current);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const salvo = useRef(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(inicial.current);

  // Nielsen #3/#5: sair com alterações não salvas pede confirmação.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !salvo.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const input = {
    titulo: form.titulo,
    programa: form.programa,
    dataAbertura: fromInputDate(form.abertura, false),
    dataEncerramento: fromInputDate(form.encerramento, true),
    cotasPorArea: form.cotas.map((c) => ({
      area: c.area,
      total: c.total === "" ? Number.NaN : Number(c.total),
      ocupadas: edital?.cotasPorArea.find((o) => o.area === c.area)?.ocupadas ?? 0,
    })),
  };
  const errors: EditalErrors = validateEdital(input);
  if (mode === "somente-prazo" && edital && input.dataEncerramento <= edital.dataEncerramento) {
    errors.datas = `Escolha uma data depois de ${formatData(edital.dataEncerramento)} (apenas prorrogação).`;
  }
  const show = (k: keyof EditalErrors) => (tentouSalvar ? errors[k] : undefined);

  const set = <K extends keyof FormState>(k: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: value }));

  const areasLivres = AREAS_CNPQ.filter((a) => !form.cotas.some((c) => c.area === a));
  const bloqueiaCampos = mode !== "completo";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTentouSalvar(true);
    setErro(null);
    if (Object.keys(errors).length > 0) {
      setErro("Alguns campos precisam de ajuste. Veja as mensagens em vermelho.");
      return;
    }
    setSalvando(true);
    try {
      let destino: string;
      let flash: string;
      if (edital) {
        await atualizar({ id: edital._id, ...input });
        destino = `/editais/${edital._id}`;
        flash = mode === "somente-prazo" ? "Prazo prorrogado." : "Alterações salvas.";
      } else {
        const res = await criar(input);
        destino = `/editais/${res.id}`;
        flash = `Edital ${res.numero} criado como rascunho. Revise e publique quando estiver pronto.`;
      }
      salvo.current = true;
      navigate(destino, { state: { flash } });
    } catch (err) {
      setSalvando(false);
      setErro(friendlyError(err, "Não foi possível salvar o edital. Tente novamente."));
    }
  }

  if (mode === "bloqueado") {
    return (
      <section className="card flex flex-col items-start gap-3 p-6">
        <h1 className="font-display text-xl font-bold text-navy">
          Este edital não pode mais ser alterado
        </h1>
        <p className="text-sm text-muted">
          Depois que as inscrições encerram, os dados do edital ficam congelados para garantir a
          transparência da seleção.
        </p>
        <Link to={edital ? `/editais/${edital._id}` : "/editais"} className="btn-secondary px-4">
          Voltar ao edital
        </Link>
      </section>
    );
  }

  const cancelarPara = edital ? `/editais/${edital._id}` : "/editais";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-navy">
          {edital ? `Editar edital ${edital.numero}` : "Novo edital"}
        </h1>
        <p className="text-sm text-muted">
          {edital
            ? "As mudanças ficam registradas no histórico do edital."
            : "O edital será salvo como rascunho. Nada fica visível para a comunidade até você publicar."}
        </p>
      </header>

      {mode === "somente-prazo" && (
        <Alert tone="info" title="As inscrições deste edital já estão abertas">
          Para não prejudicar quem já se inscreveu, só é possível prorrogar a data de encerramento.
          Os demais campos estão bloqueados.
        </Alert>
      )}

      <form className="card flex flex-col gap-5 p-6 md:p-8" onSubmit={handleSubmit} noValidate>
        {erro && (
          <Alert tone="error" title="Edital não salvo">
            {erro}
          </Alert>
        )}

        <Campo id="ed-titulo" label="Título" error={show("titulo")}>
          <input
            id="ed-titulo"
            className="field"
            placeholder="Ex.: Iniciação Científica 2026/2027"
            value={form.titulo}
            disabled={bloqueiaCampos}
            onChange={(e) => set("titulo", e.target.value)}
            aria-invalid={!!show("titulo")}
            aria-describedby={show("titulo") ? "ed-titulo-error" : undefined}
          />
        </Campo>

        <fieldset className="flex flex-col gap-1" disabled={bloqueiaCampos}>
          <legend className="label mb-1">
            Programa <span className="text-status-bad">*</span>
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PROGRAMAS.map((p) => (
              <label
                key={p}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                  form.programa === p
                    ? "border-navy bg-canvas"
                    : "border-hairline bg-card hover:bg-canvas"
                }`}
              >
                <input
                  type="radio"
                  name="programa"
                  className="h-4 w-4"
                  checked={form.programa === p}
                  onChange={() => set("programa", p)}
                />
                <span className="flex flex-col">
                  <span className="text-xs font-bold text-navy">{p}</span>
                  <span className="text-[11px] text-muted">{PROGRAMA_HINT[p]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Campo id="ed-abertura" label="Inscrições abrem em">
              <input
                id="ed-abertura"
                type="date"
                className="field"
                value={form.abertura}
                disabled={bloqueiaCampos}
                onChange={(e) => set("abertura", e.target.value)}
                aria-invalid={!!show("datas")}
                aria-describedby="ed-datas-msg"
              />
            </Campo>
            <Campo
              id="ed-encerramento"
              label={
                mode === "somente-prazo" ? "Novo prazo de encerramento" : "Inscrições encerram em"
              }
            >
              <input
                id="ed-encerramento"
                type="date"
                className="field"
                value={form.encerramento}
                min={form.abertura || undefined}
                onChange={(e) => set("encerramento", e.target.value)}
                aria-invalid={!!show("datas")}
                aria-describedby="ed-datas-msg"
              />
            </Campo>
          </div>
          {show("datas") ? (
            <ErroCampo id="ed-datas-msg">{show("datas")}</ErroCampo>
          ) : (
            <p id="ed-datas-msg" className="text-[11px] text-muted">
              As inscrições vão até 23h59 do dia de encerramento. Depois disso o edital passa
              sozinho para “Em análise”.
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2" disabled={bloqueiaCampos}>
          <legend className="label mb-1">
            Bolsas por grande área CNPq <span className="text-status-bad">*</span>
          </legend>
          <ul className="flex flex-col gap-2">
            {form.cotas.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <label htmlFor={`cota-area-${i}`} className="sr-only">
                  Área {i + 1}
                </label>
                <select
                  id={`cota-area-${i}`}
                  className="field flex-1 sm:max-w-sm"
                  value={c.area}
                  onChange={(e) =>
                    set(
                      "cotas",
                      form.cotas.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)),
                    )
                  }
                >
                  {[c.area, ...areasLivres].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <label htmlFor={`cota-total-${i}`} className="sr-only">
                  Número de bolsas para {c.area}
                </label>
                <input
                  id={`cota-total-${i}`}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  className="field w-28"
                  placeholder="Bolsas"
                  value={c.total}
                  onChange={(e) =>
                    set(
                      "cotas",
                      form.cotas.map((x, j) => (j === i ? { ...x, total: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-status-bad disabled:opacity-40"
                  aria-label={`Remover ${c.area}`}
                  disabled={form.cotas.length === 1}
                  title={
                    form.cotas.length === 1 ? "O edital precisa de ao menos uma área" : undefined
                  }
                  onClick={() =>
                    set(
                      "cotas",
                      form.cotas.filter((_, j) => j !== i),
                    )
                  }
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
                    delete
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="btn-secondary px-3 text-xs"
              disabled={areasLivres.length === 0}
              onClick={() => set("cotas", [...form.cotas, { area: areasLivres[0], total: "" }])}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                add
              </span>
              Adicionar área
            </button>
            <span className="text-xs tabular-nums text-muted">
              Total:{" "}
              <strong className="text-ink">
                {form.cotas.reduce((s, c) => s + (Number(c.total) || 0), 0)}
              </strong>{" "}
              bolsas
            </span>
          </div>
          {show("cotas") && <ErroCampo id="ed-cotas-error">{show("cotas")}</ErroCampo>}
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
          <Link to={cancelarPara} className="btn-secondary px-4">
            Cancelar
          </Link>
          <button type="submit" className="btn-primary px-4" disabled={salvando}>
            {salvando
              ? "Salvando…"
              : mode === "somente-prazo"
                ? "Prorrogar prazo"
                : edital
                  ? "Salvar alterações"
                  : "Salvar rascunho"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Descartar alterações?"
        confirmLabel="Descartar e sair"
        cancelLabel="Continuar editando"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        Você preencheu dados que ainda não foram salvos. Se sair agora, eles serão perdidos.
      </ConfirmDialog>
    </section>
  );
}

function Campo({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label" htmlFor={id}>
        {label} <span className="text-status-bad">*</span>
      </label>
      {children}
      {error && <ErroCampo id={`${id}-error`}>{error}</ErroCampo>}
    </div>
  );
}

function ErroCampo({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1 text-[11px] font-semibold text-status-bad">
      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
        error
      </span>
      {children}
    </p>
  );
}
