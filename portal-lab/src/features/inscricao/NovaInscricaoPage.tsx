import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  GRANDES_AREAS_CNPQ,
  etapaAnexosSchema,
  etapaDadosSchema,
  etapaProjetoSchema,
} from "./schemas";
import { DropzonePdf, Stepper, type Step } from "./Stepper";
import { useAutoSave } from "./useAutoSave";
import { PageHeader } from "../../components/shared/ui";
import { uploadPdfComProgresso, validarArquivoPdf } from "../../lib/upload";
import { formatarTamanho } from "../../lib/format";

/**
 * S3.1/S3.2/S3.3/S3.5 — Formulário multi-etapas da inscrição:
 * dados → projeto → anexos → revisão, com stepper (DESIGN.md), auto-save do
 * rascunho (RNF08), upload PDF com progresso (RN06) e submissão com
 * confirmação; protocolo gerado no backend (RN05).
 */
const ETAPAS: Step[] = [
  { id: "dados", titulo: "Dados da Proposta" },
  { id: "projeto", titulo: "Projeto" },
  { id: "anexos", titulo: "Anexos" },
  { id: "revisao", titulo: "Revisão & Submissão" },
];

type FormState = {
  editalId: string;
  titulo: string;
  areaCnpq: string;
  resumo: string;
  palavrasChave: string;
  orientadorId: string;
  metodologia: string;
  cronograma: string;
};

const VAZIO: FormState = {
  editalId: "",
  titulo: "",
  areaCnpq: "",
  resumo: "",
  palavrasChave: "",
  orientadorId: "",
  metodologia: "",
  cronograma: "",
};

export function NovaInscricaoPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const editais = useQuery(api.inscricoes.index.listEditaisPublicados, {});
  const docentes = useQuery(api.users.docentes.listDocentes, {});
  const existente = useQuery(
    api.inscricoes.index.get,
    id ? { id: id as Id<"inscricoes"> } : "skip",
  );

  const criarRascunho = useMutation(api.inscricoes.index.criarRascunho);
  const salvarRascunho = useMutation(api.inscricoes.index.salvarRascunho);
  const gerarUploadUrl = useMutation(api.inscricoes.index.gerarUploadUrl);
  const registrarAnexo = useMutation(api.inscricoes.index.registrarAnexo);
  const removerAnexo = useMutation(api.inscricoes.index.removerAnexo);
  const submeterMutation = useMutation(api.inscricoes.index.submeter);

  const [inscricaoId, setInscricaoId] = useState<string | null>(id ?? null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [etapa, setEtapa] = useState(0);
  const [errosEtapa, setErrosEtapa] = useState<string[]>([]);
  const [progressoPlano, setProgressoPlano] = useState<number | null>(null);
  const [progressoLattes, setProgressoLattes] = useState<number | null>(null);
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  const [declaracao, setDeclaracao] = useState(false);
  const [submetendo, setSubmetendo] = useState(false);
  const [erroSubmissao, setErroSubmissao] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  // Cria o rascunho assim que um edital é escolhido no modo "nova inscrição".
  useEffect(() => {
    if (inscricaoId || !form.editalId || criando) return;
    setCriando(true);
    criarRascunho({ editalId: form.editalId as Id<"editais"> })
      .then(({ id: novoId }) => {
        setInscricaoId(novoId);
        // A URL passa a apontar para o rascunho: refresh retoma de onde parou.
        window.history.replaceState(null, "", `/nova-inscricao/${novoId}`);
      })
      .catch(() => setCriando(false))
      .finally(() => setCriando(false));
  }, [inscricaoId, form.editalId, criarRascunho, criando]);

  // Hidrata o formulário a partir do rascunho carregado (continuar edição).
  const hidratado = useRef(false);
  useEffect(() => {
    if (!id || !existente || hidratado.current) return;
    hidratado.current = true;
    setForm({
      editalId: existente.inscricao.editalId,
      titulo: existente.inscricao.titulo,
      areaCnpq: existente.inscricao.areaCnpq,
      resumo: existente.inscricao.resumo,
      palavrasChave: existente.inscricao.palavrasChave.join(", "),
      orientadorId: existente.inscricao.orientadorId ?? "",
      metodologia: existente.inscricao.metodologia ?? "",
      cronograma: existente.inscricao.cronograma ?? "",
    });
  }, [id, existente]);

  // Auto-save (S3.5): payload parcial apenas com campos preenchidos.
  const payloadAutoSave = useMemo(() => {
    if (!inscricaoId) return null;
    const dados: Record<string, unknown> = {};
    if (form.titulo) dados.titulo = form.titulo;
    if (form.areaCnpq) dados.areaCnpq = form.areaCnpq;
    if (form.resumo) dados.resumo = form.resumo;
    if (form.metodologia) dados.metodologia = form.metodologia;
    if (form.cronograma) dados.cronograma = form.cronograma;
    if (form.palavrasChave) {
      dados.palavrasChave = form.palavrasChave
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    }
    if (form.orientadorId) dados.orientadorId = form.orientadorId;
    return Object.keys(dados).length > 0 ? dados : null;
  }, [inscricaoId, form]);

  const estadoSave = useAutoSave(payloadAutoSave, (dados) =>
    salvarRascunho({ id: inscricaoId as Id<"inscricoes">, dados }),
  );

  const inscricao = existente?.inscricao;
  const emRascunho = !inscricao || inscricao.status === "rascunho";

  function validarEtapa(indice: number): string[] {
    const palavrasChave = form.palavrasChave
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (indice === 0) {
      const parsed = etapaDadosSchema.safeParse({
        editalId: form.editalId,
        titulo: form.titulo,
        areaCnpq: form.areaCnpq,
        resumo: form.resumo,
        palavrasChave,
        orientadorId: form.orientadorId,
      });
      return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
    }
    if (indice === 1) {
      const parsed = etapaProjetoSchema.safeParse({
        metodologia: form.metodologia,
        cronograma: form.cronograma,
      });
      return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
    }
    if (indice === 2) {
      const parsed = etapaAnexosSchema.safeParse({
        planoTrabalhoFileId: inscricao?.planoTrabalhoFileId ?? "",
      });
      return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
    }
    return declaracao ? [] : ["Declaração de veracidade obrigatória."];
  }

  function avancar() {
    const erros = validarEtapa(etapa);
    setErrosEtapa(erros);
    if (erros.length === 0) {
      setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1));
    }
  }

  async function handleArquivo(file: File, tipo: "plano_trabalho" | "lattes") {
    setUploadErro(null);
    const erroPre = validarArquivoPdf(file);
    if (erroPre) {
      setUploadErro(erroPre);
      return;
    }
    if (!inscricaoId) {
      setUploadErro("Escolha o edital antes de anexar documentos.");
      return;
    }
    const setProgresso = tipo === "plano_trabalho" ? setProgressoPlano : setProgressoLattes;
    setProgresso(0);
    const resultado = await uploadPdfComProgresso({
      file,
      gerarUploadUrl: () => gerarUploadUrl({}),
      registrarAnexo: (a) =>
        registrarAnexo({
          ...a,
          inscricaoId: a.inscricaoId as Id<"inscricoes">,
          storageId: a.storageId as Id<"_storage">,
        }),
      inscricaoId,
      tipo,
      onProgress: setProgresso,
    });
    if (!resultado.ok) {
      setUploadErro(resultado.erro);
      setProgresso(null);
    }
  }

  async function remover(fileId: string | undefined, setProgresso: (v: number | null) => void) {
    if (!fileId) return;
    setProgresso(null);
    await removerAnexo({ arquivoId: fileId as Id<"arquivos"> });
  }

  async function submeter() {
    if (!inscricaoId) return;
    setSubmetendo(true);
    setErroSubmissao(null);
    try {
      const { protocolo } = await submeterMutation({ id: inscricaoId as Id<"inscricoes"> });
      navigate(`/inscricoes/${inscricaoId}?protocolo=${encodeURIComponent(protocolo)}`);
    } catch (err) {
      const data = (err as Error & { data?: { message?: string } }).data;
      setErroSubmissao(data?.message ?? (err instanceof Error ? err.message : "Falha na submissão."));
    } finally {
      setSubmetendo(false);
    }
  }

  if (editais === undefined || docentes === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted">
        <span aria-hidden="true" className="material-symbols-outlined animate-spin text-[24px] text-navy">
          progress_activity
        </span>
        Carregando formulário…
      </div>
    );
  }

  if (editais.length === 0) {
    return <SemEdital />;
  }

  if (id && existente && !emRascunho) {
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-teal">lock</span>
        <h1 className="font-display text-xl font-bold text-navy">Inscrição submetida</h1>
        <p className="text-sm text-muted">Esta inscrição é somente-leitura (RN05).</p>
        <Link to={`/inscricoes/${id}`} className="btn-primary px-4">Ver detalhes</Link>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        titulo={id ? "Continuar Inscrição" : "Nova Inscrição"}
        subtitulo="Formulário multi-etapas com rascunho automático — nada é perdido se a aba fechar (RNF08)."
      />

      <div className="card p-4">
        <Stepper etapas={ETAPAS} atual={etapa} onIrPara={(i) => setEtapa(i)} />
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
          {estadoSave === "saving" && (
            <>
              <span aria-hidden="true" className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
              Salvando rascunho…
            </>
          )}
          {estadoSave === "dirty" && <span>Rascunho aguardando salvamento…</span>}
          {estadoSave === "saved" && (
            <>
              <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-teal">cloud_done</span>
              Rascunho salvo automaticamente
            </>
          )}
          {estadoSave === "error" && (
            <span className="font-semibold text-status-bad">Falha ao salvar — verifique a conexão.</span>
          )}
        </div>
      </div>

      {errosEtapa.length > 0 && (
        <div className="rounded-lg border border-status-bad-border bg-status-bad-bg p-3 text-xs text-ink" role="alert">
          <p className="mb-1 font-bold">Corrija para avançar:</p>
          <ul className="list-disc pl-4">
            {errosEtapa.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {etapa === 0 && (
        <div className="card flex flex-col gap-4 p-6">
          <h2 className="font-display text-lg font-bold text-navy">Etapa 1 — Dados da Proposta</h2>

          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="edital">Edital <span className="text-status-bad">*</span></label>
            <select
              id="edital"
              className="field"
              value={form.editalId}
              disabled={Boolean(inscricaoId)}
              onChange={(e) => setForm((f) => ({ ...f, editalId: e.target.value }))}
            >
              <option value="">Selecione o edital…</option>
              {editais.map((e) => (
                <option key={e._id} value={e._id}>
                  Edital {e.numero} — {e.titulo} (até {new Date(e.dataEncerramento).toLocaleDateString("pt-BR")})
                </option>
              ))}
            </select>
            {inscricaoId && (
              <p className="text-[11px] text-muted">Edital fixado após a criação do rascunho.</p>
            )}
          </div>

          <Campo
            id="titulo"
            label="Título Oficial da Proposta"
            obrigatorio
            hint="Mínimo de 10 caracteres. O título constará no certificado institucional."
          >
            <input
              id="titulo"
              className="field"
              value={form.titulo}
              maxLength={200}
              placeholder="Digite o título acadêmico conciso e elucidativo…"
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </Campo>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Campo id="area" label="Grande Área CNPq" obrigatorio>
              <select
                id="area"
                className="field"
                value={form.areaCnpq}
                onChange={(e) => setForm((f) => ({ ...f, areaCnpq: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {GRANDES_AREAS_CNPQ.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Campo>
            <Campo
              id="orientador"
              label="Professor Orientador (carta-aceite)"
              obrigatorio
              hint="O docente receberá a solicitação e precisa aprovar o vínculo antes da submissão."
            >
              <select
                id="orientador"
                className="field"
                value={form.orientadorId}
                onChange={(e) => setForm((f) => ({ ...f, orientadorId: e.target.value }))}
              >
                <option value="">Selecione o docente…</option>
                {docentes.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name ?? d.email} — {d.departamento ?? "—"}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo id="resumo" label="Resumo da Proposta" obrigatorio hint="Mínimo de 50 caracteres.">
            <textarea
              id="resumo"
              className="field h-auto min-h-[96px] py-2"
              value={form.resumo}
              maxLength={2000}
              placeholder="Descreva problema, objetivos e resultados esperados…"
              onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
            />
          </Campo>

          <Campo
            id="palavras"
            label="Palavras-chave"
            obrigatorio
            hint="Separe por vírgulas — ao menos 3 (padrão Lattes/CNPq)."
          >
            <input
              id="palavras"
              className="field"
              value={form.palavrasChave}
              placeholder="ex.: visão computacional, aprendizado profundo, saúde"
              onChange={(e) => setForm((f) => ({ ...f, palavrasChave: e.target.value }))}
            />
          </Campo>
        </div>
      )}

      {etapa === 1 && (
        <div className="card flex flex-col gap-4 p-6">
          <h2 className="font-display text-lg font-bold text-navy">Etapa 2 — Projeto</h2>
          <Campo id="metodologia" label="Metodologia e Arquitetura da Pesquisa" obrigatorio hint="Mínimo de 100 caracteres.">
            <textarea
              id="metodologia"
              className="field h-auto min-h-[140px] py-2"
              value={form.metodologia}
              placeholder="Descreva métodos, técnicas, insumos e ambientes computacionais…"
              onChange={(e) => setForm((f) => ({ ...f, metodologia: e.target.value }))}
            />
          </Campo>
          <Campo id="cronograma" label="Cronograma de Execução" obrigatorio hint="Mínimo de 50 caracteres. Cite marcos e entregas.">
            <textarea
              id="cronograma"
              className="field h-auto min-h-[120px] py-2"
              value={form.cronograma}
              placeholder="ex.: Meses 1–3: levantamento bibliográfico; Meses 4–7: experimentos…"
              onChange={(e) => setForm((f) => ({ ...f, cronograma: e.target.value }))}
            />
          </Campo>
        </div>
      )}

      {etapa === 2 && (
        <div className="card flex flex-col gap-5 p-6">
          <h2 className="font-display text-lg font-bold text-navy">Etapa 3 — Anexos</h2>
          {uploadErro && (
            <p className="rounded-lg border border-status-bad-border bg-status-bad-bg p-3 text-xs text-ink" role="alert">
              {uploadErro}
            </p>
          )}
          <DropzonePdf
            rotulo="Plano de Trabalho (obrigatório)"
            obrigatorio
            arquivo={
              inscricao?.planoTrabalhoFileId
                ? {
                    nome: nomeAnexo(existente, "plano_trabalho"),
                    tamanho: tamanhoAnexo(existente, "plano_trabalho"),
                  }
                : null
            }
            progresso={progressoPlano}
            onArquivo={(f) => void handleArquivo(f, "plano_trabalho")}
            onRemover={() => void remover(inscricao?.planoTrabalhoFileId, setProgressoPlano)}
          />
          <DropzonePdf
            rotulo="Currículo Lattes em PDF (opcional)"
            obrigatorio={false}
            arquivo={
              inscricao?.lattesFileId
                ? {
                    nome: nomeAnexo(existente, "lattes"),
                    tamanho: tamanhoAnexo(existente, "lattes"),
                  }
                : null
            }
            progresso={progressoLattes}
            onArquivo={(f) => void handleArquivo(f, "lattes")}
            onRemover={() => void remover(inscricao?.lattesFileId, setProgressoLattes)}
          />
        </div>
      )}

      {etapa === 3 && inscricao && (
        <div className="card flex flex-col gap-4 p-6">
          <h2 className="font-display text-lg font-bold text-navy">Etapa 4 — Revisão & Submissão</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Revisao rotulo="Edital" valor={nomeEdital(editais, form.editalId)} />
            <Revisao rotulo="Título" valor={form.titulo || "—"} />
            <Revisao rotulo="Área CNPq" valor={form.areaCnpq || "—"} />
            <Revisao
              rotulo="Orientador"
              valor={nomeDocente(docentes, form.orientadorId)}
              extra={badgeVinculo(inscricao.orientadorStatus)}
            />
            <Revisao rotulo="Plano de trabalho" valor={inscricao.planoTrabalhoFileId ? "Anexado ✓" : "Faltando"} />
            <Revisao rotulo="Lattes" valor={inscricao.lattesFileId ? "Anexado ✓" : "Não anexado (opcional)"} />
          </dl>

          <label className="flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs text-muted">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={declaracao}
              onChange={(e) => setDeclaracao(e.target.checked)}
            />
            Declaro a veracidade dos dados apresentados e o compromisso com a carga horária do programa.
          </label>

          {erroSubmissao && (
            <div className="rounded-lg border border-status-bad-border bg-status-bad-bg p-3 text-xs text-ink" role="alert">
              {erroSubmissao}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
            <button
              type="button"
              className="btn-primary px-5"
              disabled={!declaracao || submetendo}
              onClick={() => {
                if (window.confirm("Confirmar a submissão final? Após enviar, a inscrição fica somente-leitura (RN05).")) {
                  void submeter();
                }
              }}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">send</span>
              {submetendo ? "Submetendo…" : "Submeter inscrição final"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="btn-secondary px-4"
          disabled={etapa === 0}
          onClick={() => setEtapa((e) => Math.max(0, e - 1))}
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>
          Voltar
        </button>
        {etapa < ETAPAS.length - 1 ? (
          <button type="button" className="btn-primary px-5" onClick={avancar}>
            Avançar
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        ) : (
          <span className="text-xs text-muted">Revise e confirme a submissão acima.</span>
        )}
      </div>
    </section>
  );
}

function Campo({
  id,
  label,
  obrigatorio,
  hint,
  children,
}: {
  id: string;
  label: string;
  obrigatorio?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label" htmlFor={id}>
        {label} {obrigatorio && <span className="text-status-bad">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Revisao({ rotulo, valor, extra }: { rotulo: string; valor: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className="mt-1 flex items-center gap-2 text-sm text-ink">
        {valor}
        {extra}
      </dd>
    </div>
  );
}

function badgeVinculo(status: string | undefined) {
  const cfg =
    status === "aprovado"
      ? { label: "vínculo aprovado", cls: "bg-status-ok-bg text-[#065f46] border-status-ok-border" }
      : status === "recusado"
        ? { label: "vínculo recusado", cls: "bg-status-bad-bg text-status-bad border-status-bad-border" }
        : { label: "aguardando aceite", cls: "bg-status-warn-bg text-status-warn border-status-warn-border" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.cls}`}>{cfg.label}</span>
  );
}

function SemEdital() {
  const seedEditalDemo = useMutation(api.inscricoes.index.seedEditalDemo);
  const [criando, setCriando] = useState(false);
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-teal">campaign</span>
      <h2 className="font-display text-lg font-bold text-navy">Nenhum edital aberto</h2>
      <p className="max-w-md text-sm text-muted">
        Não há editais publicados com inscrições vigentes. Para demonstração local, você pode carregar um
        edital PIBIC de exemplo.
      </p>
      <button
        type="button"
        className="btn-primary px-4"
        disabled={criando}
        onClick={() => {
          setCriando(true);
          void seedEditalDemo({}).finally(() => setCriando(false));
        }}
      >
        {criando ? "Carregando…" : "Carregar edital de demonstração"}
      </button>
    </div>
  );
}

type GetResult = {
  inscricao: { planoTrabalhoFileId?: string; lattesFileId?: string };
  arquivos: { _id: string; tipo: string; nome: string; tamanho: number }[];
} | null | undefined;

function nomeAnexo(existente: GetResult, tipo: "plano_trabalho" | "lattes"): string {
  const a = existente?.arquivos.find((x) => x.tipo === tipo);
  return a?.nome ?? "documento.pdf";
}

function tamanhoAnexo(existente: GetResult, tipo: "plano_trabalho" | "lattes"): string {
  const a = existente?.arquivos.find((x) => x.tipo === tipo);
  return a ? formatarTamanho(a.tamanho) : "";
}

function nomeEdital(editais: { _id: string; numero: string }[], id: string): string {
  const e = editais.find((x) => x._id === id);
  return e ? `Edital ${e.numero}` : "—";
}

function nomeDocente(docentes: { _id: string; name?: string; email?: string }[], id: string): string {
  const d = docentes.find((x) => x._id === id);
  return d ? (d.name ?? d.email ?? "—") : "—";
}
