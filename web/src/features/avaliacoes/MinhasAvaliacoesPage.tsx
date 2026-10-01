import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

import { formatDate, formatNota } from '@/shared/lib/format';
import type { StatusInfo } from '@/shared/lib/labels';
import { Code, StatusBadge, Tag } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { FilterPills } from '@/shared/ui/FilterPills';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useMinhasAvaliacoes } from './api';

const STATUS: Record<'PENDENTE' | 'CONCLUIDA', StatusInfo> = {
  PENDENTE: { label: 'Parecer pendente', tone: 'warning' },
  CONCLUIDA: { label: 'Parecer enviado', tone: 'success' },
};

type Filtro = 'PENDENTE' | 'CONCLUIDA';

export function MinhasAvaliacoesPage() {
  const { data, isPending, isError, error, refetch } = useMinhasAvaliacoes();
  const [filtro, setFiltro] = useState<Filtro>('PENDENTE');
  const lista = data?.filter((a) => a.status === filtro) ?? [];

  return (
    <>
      <PageHeader title="Minhas avaliações" description="Propostas atribuídas a você para emitir parecer com a rubrica." />
      <div className="mb-4">
        <FilterPills<Filtro>
          label="Filtrar avaliações"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'PENDENTE', label: 'Pendentes', count: data?.filter((a) => a.status === 'PENDENTE').length },
            { value: 'CONCLUIDA', label: 'Concluídas', count: data?.filter((a) => a.status === 'CONCLUIDA').length },
          ]}
        />
      </div>
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-6 w-6" />}
          title={filtro === 'PENDENTE' ? 'Nenhuma avaliação pendente' : 'Nenhum parecer enviado ainda'}
          description="Quando a gestão atribuir uma proposta a você, ela aparece aqui e você recebe uma notificação."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((a) => (
            <Card key={a.id} className="flex flex-col p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Code>{a.inscricao.protocolo ?? '-'}</Code>
                <StatusBadge status={STATUS[a.status]} />
              </div>
              <h2 className="mt-3 font-semibold leading-snug">
                <Link to={`/avaliacoes/${a.id}`} className="hover:underline">
                  {a.inscricao.titulo}
                </Link>
              </h2>
              <div className="mt-2">
                <Tag>{a.inscricao.subareaNome}</Tag>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                <span className="text-ink-subtle">
                  {a.status === 'CONCLUIDA'
                    ? `Nota ${formatNota(a.notaFinal)} em ${formatDate(a.concluidaEm)}`
                    : `Atribuída em ${formatDate(a.atribuidaEm)}`}
                </span>
                <ButtonLink to={`/avaliacoes/${a.id}`} size="sm" variant={a.status === 'PENDENTE' ? 'primary' : 'secondary'}>
                  {a.status === 'PENDENTE' ? 'Avaliar' : 'Ver parecer'}
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
