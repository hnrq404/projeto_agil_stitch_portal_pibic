import { useParams } from 'react-router-dom';

import { formatDate } from '@/shared/lib/format';
import { BOLSA_LABEL, EDITAL_STATUS } from '@/shared/lib/labels';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { CotaLinha } from '@/shared/ui/DataDisplay';
import { ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useEditalPublico } from './api';
import { InscreverLink } from './EditaisPublicosPage';

export function EditalPublicoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: edital, isPending, isError, error, refetch } = useEditalPublico(id);

  if (isPending) return <LoadingState label="Carregando edital..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow={<Code>{edital.numero}</Code>}
        title={edital.titulo}
        back={{ to: '/editais', label: 'Editais abertos' }}
        actions={<InscreverLink edital={edital} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Sobre o edital" actions={<StatusBadge status={EDITAL_STATUS[edital.status]} />} />
          <div className="space-y-5 p-5">
            {edital.descricao && <p className="text-sm leading-relaxed text-ink-muted">{edital.descricao}</p>}
            <dl className="grid gap-4 sm:grid-cols-3">
              <DataItem label="Tipo de bolsa">{BOLSA_LABEL[edital.tipoBolsa]}</DataItem>
              <DataItem label="Início das inscrições">{formatDate(edital.dataInicioInscricoes)}</DataItem>
              <DataItem label="Fim das inscrições">{formatDate(edital.dataFimInscricoes)}</DataItem>
            </dl>
            <div className="rounded-lg bg-canvas p-4 text-sm text-ink-muted">
              Para se inscrever você vai precisar de: título e resumo do projeto, objetivos, metodologia, indicação de
              um orientador, plano de trabalho e currículo Lattes em PDF (até 10 MB cada).
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Cotas por subárea CNPq" description={`${edital.bolsasAlocadas} de ${edital.totalCotas} bolsas alocadas`} />
          <div className="space-y-4 p-5">
            {edital.cotas.map((c) => (
              <CotaLinha key={c.subareaCode} nome={c.subareaNome} usadas={c.alocadas} total={c.quantidade} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
