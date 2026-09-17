import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { InscricaoDto } from "../../../convex/inscricoes/index";
import { formatarData } from "../../lib/format";
import { EmptyState, PageHeader, StatusBadge } from "../../components/shared/ui";

/**
 * S3.4 — Minhas Inscrições: cards com protocolo (mono), StatusBadge e ações
 * "Continuar edição" (rascunho) / "Ver detalhes". Para docentes, exibe a
 * seção de solicitações de orientação com Aprovar/Recusar (carta-aceite S3).
 */
export function MinhasInscricoesPage() {
  const navigate = useNavigate();
  const minhas = useQuery(api.inscricoes.index.listMinhas, {});
  const orientacao = useQuery(api.inscricoes.index.listOrientacao, {});

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        titulo="Minhas Inscrições"
        subtitulo="Acompanhe o status das suas propostas em tempo real (RNF07). Rascunhos podem ser continuados a qualquer momento."
        acao={
          <Link to="/nova-inscricao" className="btn-primary px-4">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add_circle</span>
            Nova Inscrição
          </Link>
        }
      />

      {minhas === undefined ? (
        <Carregando label="Carregando inscrições…" />
      ) : minhas.length === 0 ? (
        <EmptyState
          icon="edit_note"
          titulo="Nenhuma inscrição ainda"
          descricao="Submeta sua primeira proposta de pesquisa a um edital PIBIC/PIBITI publicado. Você pode salvar rascunhos e continuar depois."
          acao={
            <Link to="/nova-inscricao" className="btn-primary px-4">
              Iniciar inscrição
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {minhas.map((i) => (
            <InscricaoCard key={i._id} inscricao={i} />
          ))}
        </ul>
      )}

      {/* Painel do docente: solicitações de orientação (carta-aceite) */}
      {orientacao !== undefined && orientacao.length > 0 && (
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-navy">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-amber">how_to_reg</span>
            Solicitações de Orientação
          </h2>
          <p className="text-xs text-muted">
            Propostas em que você foi indicado como orientador. Aprovar a vinculação destrava a submissão do discente.
          </p>
          <ul className="flex flex-col divide-y divide-hairline">
            {orientacao.map((i) => (
              <OrientacaoItem key={i._id} inscricao={i} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  function InscricaoCard({ inscricao }: { inscricao: InscricaoDto }) {
    return (
      <li className="card flex flex-col gap-3 p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs text-muted">
            {inscricao.protocolo ?? "rascunho sem protocolo"}
          </span>
          <StatusBadge status={inscricao.status} />
        </div>
        <h3 className="font-display text-base font-bold text-navy">
          {inscricao.titulo || "Proposta sem título"}
        </h3>
        <p className="line-clamp-2 text-xs text-muted">{inscricao.resumo || "Sem resumo ainda."}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3">
          <span className="text-[11px] text-muted">Atualizada em {formatarData(inscricao.updatedAt)}</span>
          <div className="flex items-center gap-2">
            {inscricao.status === "rascunho" && (
              <button
                type="button"
                className="btn-secondary px-3 text-xs"
                onClick={() => navigate(`/nova-inscricao/${inscricao._id}`)}
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">edit</span>
                Continuar edição
              </button>
            )}
            <Link to={`/inscricoes/${inscricao._id}`} className="btn-secondary px-3 text-xs">
              Ver detalhes
            </Link>
          </div>
        </div>
      </li>
    );
  }

  function OrientacaoItem({ inscricao }: { inscricao: InscricaoDto }) {
    const aprovarVinculo = useMutation(api.inscricoes.index.aprovarVinculo);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    async function responder(aprovar: boolean) {
      setBusy(true);
      setFeedback(null);
      try {
        await aprovarVinculo({ id: inscricao._id, aprovar });
        setFeedback(aprovar ? "Vínculo aprovado." : "Vínculo recusado.");
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Falha ao responder.");
      } finally {
        setBusy(false);
      }
    }

    return (
      <li className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-navy">{inscricao.titulo || "Proposta sem título"}</span>
          <span className="text-xs text-muted">
            Status do vínculo: <strong>{inscricao.orientadorStatus ?? "pendente"}</strong> · atualizada em{" "}
            {formatarData(inscricao.updatedAt)}
          </span>
          {feedback && <span className="text-[11px] font-semibold text-teal">{feedback}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/inscricoes/${inscricao._id}`} className="btn-secondary px-3 text-xs">
            Abrir
          </Link>
          {inscricao.status === "rascunho" && inscricao.orientadorStatus !== "aprovado" && (
            <>
              <button
                type="button"
                className="btn-primary px-3 text-xs"
                disabled={busy}
                onClick={() => void responder(true)}
              >
                Aprovar
              </button>
              <button
                type="button"
                className="btn-secondary px-3 text-xs"
                disabled={busy}
                onClick={() => void responder(false)}
              >
                Recusar
              </button>
            </>
          )}
        </div>
      </li>
    );
  }
}

function Carregando({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-muted">
      <span aria-hidden="true" className="material-symbols-outlined animate-spin text-[24px] text-navy">
        progress_activity
      </span>
      {label}
    </div>
  );
}
