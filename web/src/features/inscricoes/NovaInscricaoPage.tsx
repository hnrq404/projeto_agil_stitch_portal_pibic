import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';

import { useEditaisPublicos } from '@/features/editais/api';
import { formatDate } from '@/shared/lib/format';
import { BOLSA_LABEL } from '@/shared/lib/labels';
import { Code, Tag } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useCriarInscricao } from './api';

/**
 * Professor: com ?edital=ID cria o rascunho do projeto e abre o formulário.
 * Sem parâmetro, lista os editais abertos pela UNICAP.
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

  if (criar.isError) {
    return (
      <>
        <PageHeader title="Novo projeto" back={{ to: '/inscricoes/nova', label: 'Escolher edital' }} />
        <ErrorState error={criar.error} />
      </>
    );
  }
  return <LoadingState label="Preparando o projeto..." />;
}

function EscolherEdital() {
  const { data: editais, isPending, isError, error, refetch } = useEditaisPublicos();
  return (
    <>
      <PageHeader
        title="Novo projeto"
        description="Escolha o edital aberto pela UNICAP ao qual o projeto será enviado."
        back={{ to: '/inscricoes', label: 'Meus projetos' }}
      />
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
                <p className="mt-1 text-sm text-ink-muted">Envio de projetos até {formatDate(e.dataFimInscricoes)}</p>
                <div className="mt-4">
                  <ButtonLink to={`/inscricoes/nova?edital=${e.id}`} size="sm">
                    Escrever projeto neste edital
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
