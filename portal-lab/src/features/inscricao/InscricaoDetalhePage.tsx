import { useMutation, useQuery } from "convex/react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatarData, formatarDataHora, formatarTamanho } from "../../lib/format";
import { ehIdConvex } from "../../lib/convex-id";
import { ErrorBoundary, PageHeader, StatusBadge } from "../../components/shared/ui";
import type { InscricaoDto } from "../../../convex/inscricoes/index";

/**
 * S3.4 — Detalhe da Inscrição: dados, anexos com download, timeline do fluxo
 * de estados ([[Arquitetura]] §5) e painel de aceite do orientador. Dados
 * reativos via Convex (RNF07).
 */
const FLUXO: { status: InscricaoDto["status"]; rotulo: string }[] = [
  { status: "rascunho", rotulo: "Rascunho em elaboração" },
  { status: "submetida", rotulo: "Submetida ao edital" },
  { status: "em_triagem", rotulo: "Em triagem/avaliação" },
  { status: "avaliada", rotulo: "Avaliada pela comissão" },
  { status: "aprovada", rotulo: "Aprovada e homologada" },
];

/** Página de detalhe protegida por ErrorBoundary (erros de query não derrubam a SPA). */
export function InscricaoDetalhePage() {
  return (
    <ComBoundary>
      <InscricaoDetalheConteudo />
    </ComBoundary>
  );
}

function InscricaoDetalheConteudo() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const protocoloNovo = params.get("protocolo");

  // Id na URL precisa ser um Id do Convex; com lixo na URL o validador do
  // backend rejeita no cliente antes do handler.
  const idValido = ehIdConvex(id);
  const idSeguro = idValido ? (id as Id<"inscricoes">) : undefined;

  const detalhe = useQuery(
    api.inscricoes.index.get,
    idSeguro ? { id: idSeguro } : "skip",
  );
  const aprovarVinculo = useMutation(api.inscricoes.index.aprovarVinculo);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (id && !idValido) {
    return <NaoEncontrada mensagem="O endereço desta inscrição é inválido ou está corrompido." />;
  }
  if (detalhe === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted">
        <span aria-hidden="true" className="material-symbols-outlined animate-spin text-[24px] text-navy">
          progress_activity
        </span>
        Carregando inscrição…
      </div>
    );
  }
  if (detalhe === null) {
    return (
      <NaoEncontrada mensagem="Esta inscrição não existe ou você não tem acesso a ela." />
    );
  }

  const { inscricao, edital, discente, orientador, arquivos } = detalhe;
  const indiceAtual = FLUXO.findIndex((f) => f.status === inscricao.status);
  const plano = arquivos.find((a) => a.tipo === "plano_trabalho");
  const lattes = arquivos.find((a) => a.tipo === "lattes");

  async function responder(aprovar: boolean) {
    if (!id) return;
    setBusy(true);
    setFeedback(null);
    try {
      await aprovarVinculo({ id: id as Id<"inscricoes">, aprovar });
      setFeedback(aprovar ? "Vínculo aprovado — o discente já pode submeter." : "Vínculo recusado.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Falha ao responder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        titulo={inscricao.titulo || "Proposta sem título"}
        subtitulo={`Inscrita em ${formatarData(inscricao.submetidoEm ?? inscricao.createdAt)}${
          edital ? ` · Edital ${edital.numero} — ${edital.titulo}` : ""
        }`}
        acao={
          <Link to="/minhas-inscricoes" className="btn-secondary px-4">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>
            Voltar
          </Link>
        }
      />

      {protocoloNovo && (
        <div className="flex items-start gap-2 rounded-lg border border-status-ok-border bg-status-ok-bg p-3 text-xs text-ink" role="status">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-status-ok">celebration</span>
          <span>
            Inscrição submetida com sucesso! Protocolo:{" "}
            <strong className="font-mono">{protocoloNovo}</strong> — guarde este número para consultas junto à PRPq.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna principal */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-navy">Dados da Proposta</h2>
              <StatusBadge status={inscricao.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg border border-hairline bg-canvas px-3 py-1.5 font-mono text-xs font-bold text-navy">
                {inscricao.protocolo ?? "protocolo gerado na submissão"}
              </span>
              <span className="rounded-lg border border-hairline bg-canvas px-3 py-1.5 text-xs text-muted">
                {inscricao.areaCnpq || "Área não informada"}
              </span>
            </div>
            <div>
              <h3 className="label mb-1">Resumo</h3>
              <p className="whitespace-pre-line text-sm text-muted">{inscricao.resumo || "—"}</p>
            </div>
            {inscricao.metodologia && (
              <div>
                <h3 className="label mb-1">Metodologia</h3>
                <p className="whitespace-pre-line text-sm text-muted">{inscricao.metodologia}</p>
              </div>
            )}
            {inscricao.cronograma && (
              <div>
                <h3 className="label mb-1">Cronograma</h3>
                <p className="whitespace-pre-line text-sm text-muted">{inscricao.cronograma}</p>
              </div>
            )}
            {inscricao.palavrasChave.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {inscricao.palavrasChave.map((p) => (
                  <span key={p} className="rounded bg-hairline px-2 py-0.5 font-mono text-[11px] text-navy">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card flex flex-col gap-3 p-6">
            <h2 className="font-display text-lg font-bold text-navy">Anexos</h2>
            {arquivos.length === 0 ? (
              <p className="text-sm text-muted">Nenhum documento anexado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[plano, lattes].filter(Boolean).map((a) => (
                  <AnexoItem key={a!._id} arquivo={a!} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Coluna lateral: vínculos + timeline */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <div className="card flex flex-col gap-3 p-6">
            <h2 className="font-display text-base font-bold text-navy">Vínculos</h2>
            <div className="flex flex-col gap-2 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Discente</p>
                <p className="text-ink">{discente?.name ?? "—"}</p>
                <p className="font-mono text-[11px] text-muted">mat. {discente?.matricula ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Orientador</p>
                <p className="text-ink">{orientador?.name ?? "Não vinculado"}</p>
                <p className="text-[11px] text-muted">{orientador?.departamento ?? "—"}</p>
              </div>
            </div>
            {/* Painel de aceite — visível para o orientador vinculado em rascunho */}
            {inscricao.status === "rascunho" && inscricao.orientadorStatus !== "aprovado" && (
              <div className="flex flex-col gap-2 rounded-lg border border-status-warn-border bg-status-warn-bg p-3">
                <p className="text-xs text-ink">
                  {inscricao.orientadorStatus === "recusado"
                    ? "Orientador recusou o vínculo. Selecione outro docente no rascunho."
                    : "Aguardando aceite do orientador para liberar a submissão."}
                </p>
                {inscricao.orientadorStatus !== "recusado" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary px-3 text-xs"
                      disabled={busy}
                      onClick={() => void responder(true)}
                    >
                      Aprovar vínculo
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 text-xs"
                      disabled={busy}
                      onClick={() => void responder(false)}
                    >
                      Recusar
                    </button>
                  </div>
                )}
                {feedback && <p className="text-[11px] font-semibold text-teal">{feedback}</p>}
              </div>
            )}
          </div>

          <div className="card flex flex-col gap-3 p-6">
            <h2 className="font-display text-base font-bold text-navy">Linha do Tempo</h2>
            <ol className="flex flex-col gap-0">
              {FLUXO.map((f, i) => {
                const concluido = i <= indiceAtual;
                const atual = i === indiceAtual;
                return (
                  <li key={f.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden="true"
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          concluido ? "bg-teal text-white" : "border-2 border-hairline bg-card text-muted"
                        }`}
                      >
                        {concluido ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                      </span>
                      {i < FLUXO.length - 1 && (
                        <span aria-hidden="true" className={`h-8 w-0.5 ${concluido ? "bg-teal" : "bg-hairline"}`} />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className={`text-xs font-bold ${atual ? "text-navy" : concluido ? "text-ink" : "text-muted"}`}>
                        {f.rotulo}
                        {atual && <span className="ml-1 text-teal">• atual</span>}
                      </p>
                      {f.status === "submetida" && inscricao.submetidoEm && (
                        <p className="text-[11px] text-muted">{formatarDataHora(inscricao.submetidoEm)}</p>
                      )}
                    </div>
                  </li>
                );
              })}
              {inscricao.status === "recusada" && (
                <li className="mt-1 rounded-lg border border-status-bad-border bg-status-bad-bg p-2 text-xs font-semibold text-status-bad">
                  Proposta recusada na homologação.
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function NaoEncontrada({ mensagem }: { mensagem: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-status-bad">
        search_off
      </span>
      <h1 className="font-display text-xl font-bold text-navy">Inscrição não disponível</h1>
      <p className="text-sm text-muted">{mensagem}</p>
      <Link to="/minhas-inscricoes" className="btn-primary px-4">Minhas Inscrições</Link>
    </div>
  );
}

/**
 * Rede de segurança: erros da query reativa (sessão expirada, ConvexError
 * residual) derrubavam a página em branco — agora caem num estado com CTA.
 */
function ComBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <NaoEncontrada mensagem="Não foi possível carregar esta inscrição agora. Sua sessão pode ter expirado — recarregue a página ou volte para a lista." />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

function AnexoItem({ arquivo }: { arquivo: { _id: string; nome: string; tamanho: number; tipo: string } }) {
  const urlDownload = useQuery(api.inscricoes.index.urlDownload, { arquivoId: arquivo._id as Id<"arquivos"> });
  const rotuloTipo = arquivo.tipo === "plano_trabalho" ? "Plano de Trabalho" : "Currículo Lattes";
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-canvas p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="material-symbols-outlined text-[24px] text-status-bad">picture_as_pdf</span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-semibold text-navy">{arquivo.nome}</span>
          <span className="text-[11px] text-muted">
            {rotuloTipo} · {formatarTamanho(arquivo.tamanho)}
          </span>
        </div>
      </div>
      {urlDownload ? (
        <a
          href={urlDownload}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary shrink-0 px-3 text-xs"
        >
          <span aria-hidden="true" className="material-symbols-outlined text-[16px]">download</span>
          Baixar
        </a>
      ) : (
        <span className="shrink-0 text-[11px] text-muted">carregando…</span>
      )}
    </li>
  );
}
