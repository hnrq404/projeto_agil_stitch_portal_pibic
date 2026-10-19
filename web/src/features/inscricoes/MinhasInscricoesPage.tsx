import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Plus } from 'lucide-react';

import { formatDate, formatRelativeDays } from '@/shared/lib/format';
import { INSCRICAO_STATUS } from '@/shared/lib/labels';
import type { Inscricao, InscricaoStatus } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { FilterPills } from '@/shared/ui/FilterPills';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useMinhasInscricoes } from './api';

/** O que o professor faz em seguida, conforme o andamento do projeto. */
function proximoPasso(inscricao: Inscricao): string {
  switch (inscricao.status) {
    case 'RASCUNHO':
      return `Rascunho atualizado ${formatRelativeDays(inscricao.atualizadoEm)}`;
    case 'DIVULGADA':
      return inscricao.discente ? `Aluno selecionado: ${inscricao.discente.nome}` : 'Recebendo candidaturas';
    case 'EM_AVALIACAO':
    case 'AVALIADA':
      return `Enviado em ${formatDate(inscricao.submetidaEm)}`;
    default:
      return `Resultado em ${formatDate(inscricao.homologadaEm)}`;
  }
}

export function InscricaoCard({ inscricao, href }: { inscricao: Inscricao; href: string }) {
  return (
    <Card className="flex flex-col p-5 transition hover:border-line-strong hover:shadow-raised">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {inscricao.edital && <Code>{`Edital ${inscricao.edital.numero}`}</Code>}
          {inscricao.protocolo && <Code>{inscricao.protocolo}</Code>}
        </div>
        <StatusBadge status={INSCRICAO_STATUS[inscricao.status]} />
      </div>
      <h2 className="mt-3 font-semibold leading-snug">
        <Link to={href} className="hover:underline">
          {inscricao.titulo || 'Projeto sem título'}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{inscricao.subareaNome || 'Subárea não definida'}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        <span className="text-ink-subtle">{proximoPasso(inscricao)}</span>
        <Link to={href} className="font-semibold text-primary hover:underline">
          {inscricao.status === 'RASCUNHO' ? 'Continuar escrevendo' : 'Ver projeto'}
        </Link>
      </div>
    </Card>
  );
}

type Filtro = 'ANDAMENTO' | 'TODOS';
const EM_ANDAMENTO: InscricaoStatus[] = ['RASCUNHO', 'DIVULGADA', 'EM_AVALIACAO', 'AVALIADA'];

/** Professor: projetos de pesquisa, do rascunho ao resultado. */
export function MinhasInscricoesPage() {
  const { data: inscricoes, isPending, isError, error, refetch } = useMinhasInscricoes();
  const [filtro, setFiltro] = useState<Filtro>('ANDAMENTO');
  const andamento = inscricoes?.filter((i) => EM_ANDAMENTO.includes(i.status)) ?? [];
  const lista = filtro === 'ANDAMENTO' ? andamento : (inscricoes ?? []);

  return (
    <>
      <PageHeader
        title="Meus projetos de pesquisa"
        description="Escreva e divulgue projetos, escolha o aluno entre os candidatos e envie ao edital."
        actions={
          <ButtonLink to="/inscricoes/nova" icon={<Plus className="h-4 w-4" aria-hidden />}>
            Novo projeto
          </ButtonLink>
        }
      />
      {inscricoes && inscricoes.length > 0 && (
        <div className="mb-4">
          <FilterPills<Filtro>
            label="Filtrar projetos"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: 'ANDAMENTO', label: 'Em andamento', count: andamento.length },
              { value: 'TODOS', label: 'Todos', count: inscricoes.length },
            ]}
          />
        </div>
      )}
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title={inscricoes.length === 0 ? 'Você ainda não tem projetos' : 'Nenhum projeto em andamento'}
          description="Escolha um edital aberto pela UNICAP para escrever o projeto. O rascunho é salvo automaticamente."
          action={<ButtonLink to="/inscricoes/nova">Novo projeto</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((i) => (
            <InscricaoCard
              key={i.id}
              inscricao={i}
              href={i.status === 'RASCUNHO' ? `/inscricoes/${i.id}/editar` : `/inscricoes/${i.id}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
