import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';

import { useEditaisPublicos } from '@/features/editais/api';
import { ApiError } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { BOLSA_LABEL } from '@/shared/lib/labels';
import { Code, Tag } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useCriarInscricao } from './api';

/**
 * Com ?edital=ID cria o rascunho e abre o formulário. Se já existe inscrição
 * nesse edital, leva à existente. Sem parâmetro, lista os editais abertos.
 */
export function NovaInscricaoPage() {
  const [params] = useSearchParams();
  const editalId = params.get('edital');
  return editalId ? <CriarRascunho editalId={editalId} /> : <EscolherEdital />;
}

function CriarRascunho({ editalId }: { editalId: string }) {
  const navigate = useNavigate();
  const criar = useCriarInscricao();
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    criar.mutate(editalId, {
      onSuccess: (inscricao) => navigate(`/inscricoes/${inscricao.id}/editar`, { replace: true }),
    });
  }, [criar, editalId, navigate]);

  if (criar.error instanceof ApiError && criar.error.status === 409) {
    const existente = (criar.error.details as { inscricaoId?: string } | undefined)?.inscricaoId;
    if (existente) return <Navigate to={`/inscricoes/${existente}`} replace />;
  }
  if (criar.isError) {
    return (
      <>
        <PageHeader title="Nova inscrição" back={{ to: '/editais', label: 'Editais abertos' }} />
        <ErrorState error={criar.error} />
      </>
    );
  }
  return <LoadingState label="Preparando sua inscrição..." />;
}

function EscolherEdital() {
  const { data: editais, isPending, isError, error, refetch } = useEditaisPublicos();
  return (
    <>
      <PageHeader title="Nova inscrição" description="Escolha o edital em que deseja se inscrever." back={{ to: '/inscricoes', label: 'Minhas inscrições' }} />
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : editais.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-6 w-6" />} title="Nenhum edital com inscrições abertas" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {editais.map((e) => (
            <li key={e.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex gap-2">
                  <Code>{e.numero}</Code>
                  <Tag>{BOLSA_LABEL[e.tipoBolsa]}</Tag>
                </div>
                <h2 className="mt-2 font-semibold">
                  <Link to={`/editais/${e.id}`} className="hover:underline">
                    {e.titulo}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-ink-muted">Inscrições até {formatDate(e.dataFimInscricoes)}</p>
                <div className="mt-4">
                  <ButtonLink to={`/inscricoes/nova?edital=${e.id}`} size="sm">
                    Inscrever-se
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
