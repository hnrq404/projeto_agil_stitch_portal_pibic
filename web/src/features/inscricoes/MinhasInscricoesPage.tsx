import { Link } from 'react-router-dom';
import { FolderOpen, Plus } from 'lucide-react';

import { formatDate, formatRelativeDays } from '@/shared/lib/format';
import { INSCRICAO_STATUS, VINCULO_STATUS } from '@/shared/lib/labels';
import type { Inscricao } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useMinhasInscricoes } from './api';

export function InscricaoCard({ inscricao, href }: { inscricao: Inscricao; href: string }) {
  const rascunho = inscricao.status === 'RASCUNHO';
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
          {inscricao.titulo || 'Proposta sem título'}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {inscricao.subareaNome || 'Subárea não definida'}
        {inscricao.orientador ? `, orientação de ${inscricao.orientador.nome}` : ''}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
        {inscricao.vinculoStatus && !rascunho ? (
          <StatusBadge status={VINCULO_STATUS[inscricao.vinculoStatus]} />
        ) : (
          <span className="text-ink-subtle">
            {rascunho
              ? `Atualizada ${formatRelativeDays(inscricao.atualizadoEm)}`
              : `Submetida em ${formatDate(inscricao.submetidaEm)}`}
          </span>
        )}
        <Link to={href} className="font-semibold text-primary hover:underline">
          {rascunho ? 'Continuar preenchimento' : 'Ver detalhes'}
        </Link>
      </div>
    </Card>
  );
}

export function MinhasInscricoesPage() {
  const { data: inscricoes, isPending, isError, error, refetch } = useMinhasInscricoes();

  return (
    <>
      <PageHeader
        title="Minhas inscrições"
        description="Acompanhe a situação das propostas que você enviou e continue os rascunhos."
        actions={
          <ButtonLink to="/inscricoes/nova" icon={<Plus className="h-4 w-4" aria-hidden />}>
            Nova inscrição
          </ButtonLink>
        }
      />
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : inscricoes.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="Você ainda não tem inscrições"
          description="Escolha um edital aberto para enviar sua proposta. O rascunho é salvo automaticamente enquanto você preenche."
          action={<ButtonLink to="/editais">Ver editais abertos</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {inscricoes.map((i) => (
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
