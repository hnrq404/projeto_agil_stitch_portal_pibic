import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Award, ClipboardList, Clock, Download, FileText, Info } from 'lucide-react';

import { useEditaisGestor } from '@/features/editais/api';
import { exportarProjetosCsv } from '@/features/projetos/api';
import { errorMessage } from '@/shared/api/http';
import { formatNota } from '@/shared/lib/format';
import { INSCRICAO_STATUS } from '@/shared/lib/labels';
import type { InscricaoStatus, PainelGestor as Painel } from '@/shared/types/api';
import { StatusBadge } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card, CardHeader } from '@/shared/ui/Card';
import { KpiTile, Meter } from '@/shared/ui/DataDisplay';
import { ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { Select } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { usePainelGestor } from './api';

const FUNIL: InscricaoStatus[] = ['SUBMETIDA', 'EM_AVALIACAO', 'AVALIADA', 'APROVADA', 'RECUSADA'];

/** Painel do gestor (RF23/RF24): KPIs, funil de propostas, cotas por subárea e alertas. */
export function PainelGestor() {
  const [editalId, setEditalId] = useState('');
  const editais = useEditaisGestor();
  const painel = usePainelGestor(editalId || undefined);
  const toast = useToast();
  const [exportando, setExportando] = useState(false);

  async function exportar() {
    setExportando(true);
    try {
      await exportarProjetosCsv(editalId || undefined);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Painel do gestor"
        title="Indicadores do programa"
        description="Ocupação de bolsas, andamento das avaliações e pontos de atenção."
        actions={
          <>
            <label className="sr-only" htmlFor="filtro-edital">
              Edital
            </label>
            <Select id="filtro-edital" value={editalId} onChange={(e) => setEditalId(e.target.value)} className="w-56">
              <option value="">Todos os editais</option>
              {editais.data
                ?.filter((e) => e.status !== 'RASCUNHO')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.numero}
                  </option>
                ))}
            </Select>
            <Button variant="secondary" icon={<Download className="h-4 w-4" aria-hidden />} loading={exportando} onClick={() => void exportar()}>
              Exportar CSV
            </Button>
          </>
        }
      />
      {painel.isPending ? (
        <LoadingState />
      ) : painel.isError ? (
        <ErrorState error={painel.error} onRetry={() => void painel.refetch()} />
      ) : (
        <Conteudo painel={painel.data} />
      )}
    </>
  );
}

function Conteudo({ painel }: { painel: Painel }) {
  const { bolsas, inscricoes, avaliacoes, editais, relatorios } = painel;
  const ocupacao = bolsas.total > 0 ? Math.round((bolsas.alocadas / bolsas.total) * 100) : 0;
  const maxFunil = Math.max(1, ...FUNIL.map((s) => inscricoes.porStatus[s]));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Ocupação de bolsas"
          icon={<Award className="h-5 w-5" />}
          value={`${ocupacao}%`}
          detail={`${bolsas.alocadas} de ${bolsas.total} bolsas alocadas`}
          accent="secondary"
        />
        <KpiTile
          label="Propostas recebidas"
          icon={<ClipboardList className="h-5 w-5" />}
          value={inscricoes.total}
          detail={`${inscricoes.porStatus.SUBMETIDA} aguardando distribuição`}
        />
        <KpiTile
          label="Pareceres pendentes"
          icon={<FileText className="h-5 w-5" />}
          value={avaliacoes.pendentes}
          detail={`${avaliacoes.concluidas} concluídos`}
        />
        <KpiTile
          label="Tempo médio de avaliação"
          icon={<Clock className="h-5 w-5" />}
          value={avaliacoes.tempoMedioDias === null ? '-' : `${formatNota(avaliacoes.tempoMedioDias)} dias`}
          detail={`${editais.publicados} edital(is) aberto(s), ${editais.encerrados} encerrado(s)`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Propostas por situação" />
          <ul className="space-y-4 p-5">
            {FUNIL.map((s) => (
              <li key={s} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <StatusBadge status={INSCRICAO_STATUS[s]} />
                  <span className="font-semibold tnum">{inscricoes.porStatus[s]}</span>
                </div>
                <Meter value={inscricoes.porStatus[s]} max={maxFunil} label={`Propostas ${INSCRICAO_STATUS[s].label}`} tone="primary" />
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <Link to="/triagem" className="text-sm font-semibold text-primary hover:underline">
              Abrir Central de Triagem
            </Link>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Cotas por subárea CNPq" description="Bolsas aprovadas frente às cotas, e a procura (propostas)." />
          {painel.cotasPorSubarea.length === 0 ? (
            <p className="p-5 text-sm text-ink-muted">Nenhum edital publicado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  <tr>
                    <th scope="col" className="px-5 py-2">Subárea</th>
                    <th scope="col" className="px-5 py-2 text-right">Propostas</th>
                    <th scope="col" className="w-48 px-5 py-2">Aprovadas / cotas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {painel.cotasPorSubarea.map((c) => (
                    <tr key={c.subareaCode}>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-ink-subtle">{c.subareaCode}</span> {c.subareaNome}
                      </td>
                      <td className="px-5 py-3 text-right tnum">{c.submetidas}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Meter value={c.aprovadas} max={c.cotas} label={`Cotas aprovadas em ${c.subareaNome}`} />
                          <span className="shrink-0 tnum text-ink-muted">
                            {c.aprovadas}/{c.cotas}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Pontos de atenção"
          description={`${relatorios.emAnalise} relatório(s) em análise, ${relatorios.atrasados} atrasado(s).`}
          actions={<ButtonLink to="/projetos" variant="secondary" size="sm">Ver projetos</ButtonLink>}
        />
        {painel.alertas.length === 0 ? (
          <p className="p-5 text-sm text-ink-muted">Nada pendente no momento.</p>
        ) : (
          <ul className="divide-y divide-line">
            {painel.alertas.map((a) => (
              <li key={a.mensagem} className="flex items-start gap-3 px-5 py-3 text-sm">
                {a.nivel === 'atencao' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-label="Atenção" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-info-700" aria-label="Informação" />
                )}
                <span className="text-ink">{a.mensagem}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
