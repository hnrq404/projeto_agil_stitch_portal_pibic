import { Link, useParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';

import { useEdital } from '@/features/editais/api';
import { formatNota } from '@/shared/lib/format';
import { INSCRICAO_STATUS } from '@/shared/lib/labels';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Card, CardHeader } from '@/shared/ui/Card';
import { CotaLinha } from '@/shared/ui/DataDisplay';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useRanking } from './api';

/** S4: ranking das propostas avaliadas por subárea, ao lado da cota disponível. */
export function RankingPage() {
  const { editalId } = useParams<{ editalId: string }>();
  const edital = useEdital(editalId);
  const ranking = useRanking(editalId);

  if (edital.isPending || ranking.isPending) return <LoadingState />;
  if (edital.isError) return <ErrorState error={edital.error} />;
  if (ranking.isError) return <ErrorState error={ranking.error} onRetry={() => void ranking.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow={<Code>{edital.data.numero}</Code>}
        title="Ranking do edital"
        description="Propostas avaliadas, ordenadas pela média dos pareceres dentro de cada subárea."
        back={{ to: `/triagem?edital=${edital.data.id}`, label: 'Central de triagem' }}
      />
      {ranking.data.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="Nenhuma proposta avaliada ainda"
          description="O ranking aparece quando os avaliadores concluírem os pareceres."
        />
      ) : (
        <div className="space-y-6">
          {edital.data.cotas.map((cota) => {
            const itens = ranking.data.filter((i) => i.inscricao.subareaCode === cota.subareaCode);
            const aprovadas = itens.filter((i) => i.inscricao.status === 'APROVADA').length;
            return (
              <Card key={cota.subareaCode}>
                <CardHeader
                  title={`${cota.subareaCode} ${cota.subareaNome}`}
                  actions={
                    <div className="w-48">
                      <CotaLinha nome="Aprovadas" usadas={aprovadas} total={cota.quantidade} />
                    </div>
                  }
                />
                {itens.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-ink-muted">Nenhuma proposta avaliada nesta subárea.</p>
                ) : (
                  <ol className="divide-y divide-line">
                    {itens.map((item, posicao) => (
                      <li key={item.inscricao.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                        <span className="w-8 text-lg font-bold text-ink-subtle tnum">{posicao + 1}º</span>
                        <div className="min-w-0 flex-1">
                          <Link to={`/triagem/${item.inscricao.id}`} className="font-semibold text-primary hover:underline">
                            {item.inscricao.titulo}
                          </Link>
                          <p className="text-xs text-ink-subtle">
                            {item.inscricao.discente?.nome}, orientação de {item.inscricao.orientador?.nome}
                          </p>
                        </div>
                        <span className="text-right">
                          <span className="block text-lg font-bold tnum">{formatNota(item.consolidado.media)}</span>
                          {item.consolidado.divergente && <span className="text-xs text-amber-800">divergência</span>}
                        </span>
                        <StatusBadge status={INSCRICAO_STATUS[item.inscricao.status]} />
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
