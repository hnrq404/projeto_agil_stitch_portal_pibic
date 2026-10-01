import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';

import { formatDate } from '@/shared/lib/format';
import { BOLSA_LABEL, EDITAL_STATUS } from '@/shared/lib/labels';
import type { EditalStatus } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { FilterPills } from '@/shared/ui/FilterPills';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useEditaisGestor } from './api';

type Filtro = EditalStatus | 'TODOS';

export function GestorEditaisPage() {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const { data: todos, isPending, isError, error, refetch } = useEditaisGestor();
  const editais = todos?.filter((e) => filtro === 'TODOS' || e.status === filtro) ?? [];
  const contar = (s: EditalStatus) => todos?.filter((e) => e.status === s).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Editais"
        description="Crie, publique e encerre editais de iniciação científica."
        actions={
          <>
            <ButtonLink to="/editais" variant="secondary">
              Ver vitrine pública
            </ButtonLink>
            <ButtonLink to="/gestor/editais/novo" icon={<Plus className="h-4 w-4" aria-hidden />}>
              Novo edital
            </ButtonLink>
          </>
        }
      />

      <div className="mb-4">
        <FilterPills<Filtro>
          label="Filtrar por situação"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'TODOS', label: 'Todos', count: todos?.length },
            { value: 'RASCUNHO', label: 'Rascunhos', count: contar('RASCUNHO') },
            { value: 'PUBLICADO', label: 'Publicados', count: contar('PUBLICADO') },
            { value: 'ENCERRADO', label: 'Encerrados', count: contar('ENCERRADO') },
          ]}
        />
      </div>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : editais.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={filtro === 'TODOS' ? 'Nenhum edital cadastrado' : 'Nenhum edital nesta situação'}
          description="Comece criando um edital em rascunho. Você pode revisá-lo antes de publicar."
          action={<ButtonLink to="/gestor/editais/novo">Criar edital</ButtonLink>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th scope="col" className="px-5 py-3">Edital</th>
                  <th scope="col" className="px-5 py-3">Bolsa</th>
                  <th scope="col" className="px-5 py-3 text-right">Bolsas</th>
                  <th scope="col" className="px-5 py-3">Inscrições</th>
                  <th scope="col" className="px-5 py-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {editais.map((e) => (
                  <tr key={e.id} className="hover:bg-canvas/60">
                    <td className="px-5 py-3">
                      <Code>{e.numero}</Code>
                      <Link to={`/gestor/editais/${e.id}`} className="mt-1 block font-semibold text-primary hover:underline">
                        {e.titulo}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{BOLSA_LABEL[e.tipoBolsa]}</td>
                    <td className="px-5 py-3 text-right tnum">{e.totalCotas}</td>
                    <td className="px-5 py-3 text-ink-muted tnum">
                      {formatDate(e.dataInicioInscricoes)} a {formatDate(e.dataFimInscricoes)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={EDITAL_STATUS[e.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
