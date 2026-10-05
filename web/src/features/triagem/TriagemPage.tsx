import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Trophy } from 'lucide-react';

import { useCnpqAreas, useEditaisGestor } from '@/features/editais/api';
import { formatDate, formatNota } from '@/shared/lib/format';
import { INSCRICAO_STATUS, VINCULO_STATUS } from '@/shared/lib/labels';
import type { InscricaoStatus, ItemTriagem } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { Field, Select } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useFilaTriagem } from './api';

const STATUS_FILTRO: InscricaoStatus[] = ['SUBMETIDA', 'EM_AVALIACAO', 'AVALIADA', 'APROVADA', 'RECUSADA'];

/** Próximo passo do gestor para cada proposta: orienta a leitura da fila. */
function proximoPasso(item: ItemTriagem): string {
  const { inscricao, consolidado } = item;
  switch (inscricao.status) {
    case 'SUBMETIDA':
      return inscricao.vinculoStatus === 'CONFIRMADO' ? 'Distribuir a avaliadores' : 'Aguardando orientador';
    case 'EM_AVALIACAO':
      return `${consolidado.concluidas} de ${consolidado.total} pareceres`;
    case 'AVALIADA':
      return 'Homologar resultado';
    default:
      return 'Concluída';
  }
}

/** S4.1: fila de propostas filtrável por edital, situação e subárea (filtros na URL, compartilháveis). */
export function TriagemPage() {
  const [params, setParams] = useSearchParams();
  const filtro = {
    editalId: params.get('edital') ?? undefined,
    status: (params.get('status') as InscricaoStatus | null) ?? undefined,
    subareaCode: params.get('subarea') ?? undefined,
  };
  const editais = useEditaisGestor();
  const areas = useCnpqAreas();
  const fila = useFilaTriagem(filtro);

  function setFiltro(chave: 'edital' | 'status' | 'subarea', valor: string) {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo, { replace: true });
  }

  const aDistribuir = fila.data?.filter((i) => i.inscricao.status === 'SUBMETIDA' && i.inscricao.vinculoStatus === 'CONFIRMADO').length ?? 0;
  const aHomologar = fila.data?.filter((i) => i.inscricao.status === 'AVALIADA').length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Central de Triagem"
        description="Distribua as propostas aos avaliadores, acompanhe os pareceres e homologue os resultados."
        actions={
          filtro.editalId && (
            <ButtonLink to={`/triagem/ranking/${filtro.editalId}`} variant="secondary" icon={<Trophy className="h-4 w-4" aria-hidden />}>
              Ranking do edital
            </ButtonLink>
          )
        }
      />

      <Card className="mb-4 grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Edital">
          <Select value={filtro.editalId ?? ''} onChange={(e) => setFiltro('edital', e.target.value)}>
            <option value="">Todos os editais</option>
            {editais.data
              ?.filter((e) => e.status !== 'RASCUNHO')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.numero}: {e.titulo}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Situação">
          <Select value={filtro.status ?? ''} onChange={(e) => setFiltro('status', e.target.value)}>
            <option value="">Todas</option>
            {STATUS_FILTRO.map((s) => (
              <option key={s} value={s}>
                {INSCRICAO_STATUS[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subárea CNPq">
          <Select value={filtro.subareaCode ?? ''} onChange={(e) => setFiltro('subarea', e.target.value)}>
            <option value="">Todas</option>
            {areas.data?.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code}: {a.name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {fila.data && (
        <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
          <strong className="text-ink tnum">{fila.data.length}</strong> proposta(s).{' '}
          <span className="tnum">{aDistribuir}</span> para distribuir, <span className="tnum">{aHomologar}</span> para
          homologar.
        </p>
      )}

      {fila.isPending ? (
        <LoadingState />
      ) : fila.isError ? (
        <ErrorState error={fila.error} onRetry={() => void fila.refetch()} />
      ) : fila.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title="Nenhuma proposta com estes filtros"
          description="Propostas aparecem aqui depois de submetidas pelos discentes."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th scope="col" className="px-5 py-3">Proposta</th>
                  <th scope="col" className="px-5 py-3">Discente / Orientador</th>
                  <th scope="col" className="px-5 py-3 text-right">Média</th>
                  <th scope="col" className="px-5 py-3">Situação</th>
                  <th scope="col" className="px-5 py-3">Próximo passo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fila.data.map((item) => {
                  const { inscricao, consolidado } = item;
                  return (
                    <tr key={inscricao.id} className="align-top hover:bg-canvas/60">
                      <td className="max-w-sm px-5 py-3">
                        <Code>{inscricao.protocolo ?? '-'}</Code>
                        <Link to={`/triagem/${inscricao.id}`} className="mt-1 block font-semibold text-primary hover:underline">
                          {inscricao.titulo}
                        </Link>
                        <span className="text-xs text-ink-subtle">
                          {inscricao.subareaNome}, edital {inscricao.edital?.numero}, submetida em {formatDate(inscricao.submetidaEm)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="block text-ink">{inscricao.discente?.nome}</span>
                        <span className="block text-xs text-ink-subtle">
                          {inscricao.orientador?.nome} {inscricao.orientador?.departamento && `(${inscricao.orientador.departamento})`}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-semibold tnum">{formatNota(consolidado.media)}</span>
                        {consolidado.divergente && (
                          <span className="mt-1 flex items-center justify-end gap-1 text-xs font-medium text-warning-800">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                            Divergência
                          </span>
                        )}
                      </td>
                      <td className="space-y-1 px-5 py-3">
                        <StatusBadge status={INSCRICAO_STATUS[inscricao.status]} />
                        {inscricao.status === 'SUBMETIDA' && inscricao.vinculoStatus && (
                          <StatusBadge status={VINCULO_STATUS[inscricao.vinculoStatus]} />
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-muted">{proximoPasso(item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
