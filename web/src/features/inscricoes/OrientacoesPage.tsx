import { useState } from 'react';
import { Users } from 'lucide-react';

import { ErrorState, EmptyState, LoadingState } from '@/shared/ui/Feedback';
import { FilterPills } from '@/shared/ui/FilterPills';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useOrientacoes } from './api';
import { InscricaoCard } from './MinhasInscricoesPage';

type Filtro = 'PENDENTES' | 'TODAS';

/** Docente: pedidos de orientação recebidos e propostas que orienta. */
export function OrientacoesPage() {
  const { data, isPending, isError, error, refetch } = useOrientacoes();
  const pendentes = data?.filter((i) => i.vinculoStatus === 'PENDENTE' && i.status === 'SUBMETIDA') ?? [];
  const [filtro, setFiltro] = useState<Filtro>('PENDENTES');
  const lista = filtro === 'PENDENTES' ? pendentes : (data ?? []);

  return (
    <>
      <PageHeader
        title="Orientações"
        description="Confirme os alunos que indicaram você como orientador(a) e acompanhe as propostas."
      />
      <div className="mb-4">
        <FilterPills<Filtro>
          label="Filtrar orientações"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'PENDENTES', label: 'Aguardando minha resposta', count: pendentes.length },
            { value: 'TODAS', label: 'Todas', count: data?.length },
          ]}
        />
      </div>
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={filtro === 'PENDENTES' ? 'Nenhum pedido aguardando resposta' : 'Nenhuma orientação ainda'}
          description="Quando um discente indicar você numa inscrição, o pedido aparece aqui e nas notificações."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((i) => (
            <InscricaoCard key={i.id} inscricao={i} href={`/inscricoes/${i.id}`} />
          ))}
        </div>
      )}
    </>
  );
}
