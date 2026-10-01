import { Link } from 'react-router-dom';
import { CalendarClock, Megaphone } from 'lucide-react';

import { useAuth } from '@/features/auth/AuthProvider';
import { diasAte, formatDate, pluralize } from '@/shared/lib/format';
import { BOLSA_LABEL } from '@/shared/lib/labels';
import type { EditalPublico } from '@/shared/types/api';
import { Code, Tag } from '@/shared/ui/Badge';
import { ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { CotaLinha } from '@/shared/ui/DataDisplay';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';

import { useEditaisPublicos } from './api';

/** Link de inscrição: discente vai ao formulário; quem não está logado, ao login (e volta depois). */
export function InscreverLink({ edital }: { edital: Pick<EditalPublico, 'id' | 'status'> }) {
  const { user } = useAuth();
  if (edital.status !== 'PUBLICADO') return null;
  if (user && user.role !== 'DISCENTE') return null;
  const destino = `/inscricoes/nova?edital=${edital.id}`;
  return (
    <ButtonLink to={user ? destino : '/login'} state={user ? undefined : { from: destino }} size="sm">
      {user ? 'Inscrever-se' : 'Entrar para se inscrever'}
    </ButtonLink>
  );
}

function EditalCard({ edital }: { edital: EditalPublico }) {
  const dias = diasAte(edital.dataFimInscricoes);
  return (
    <Card className="flex flex-col p-5 transition hover:border-line-strong hover:shadow-raised">
      <div className="flex flex-wrap items-center gap-2">
        <Code>{edital.numero}</Code>
        <Tag>{BOLSA_LABEL[edital.tipoBolsa]}</Tag>
      </div>
      <h2 className="mt-3 text-lg font-semibold leading-snug">
        <Link to={`/editais/${edital.id}`} className="hover:underline">
          {edital.titulo}
        </Link>
      </h2>
      {edital.descricao && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{edital.descricao}</p>}

      <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
        <CalendarClock className="h-4 w-4 text-amber-700" aria-hidden />
        Inscrições até <strong className="text-ink">{formatDate(edital.dataFimInscricoes)}</strong>
        <span className="text-amber-800">({dias <= 0 ? 'último dia' : `faltam ${pluralize(dias, 'dia', 'dias')}`})</span>
      </p>

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <CotaLinha nome="Bolsas alocadas" usadas={edital.bolsasAlocadas} total={edital.totalCotas} />
        <p className="text-xs text-ink-subtle">
          {edital.cotas.map((c) => `${c.subareaNome} (${c.quantidade})`).join(', ')}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Link to={`/editais/${edital.id}`} className="text-sm font-semibold text-primary hover:underline">
          Ver detalhes
        </Link>
        <InscreverLink edital={edital} />
      </div>
    </Card>
  );
}

/** Vitrine de editais com inscrições abertas (RF08 / RN04), sem login. */
export function EditaisPublicosPage() {
  const { data: editais, isPending, isError, error, refetch } = useEditaisPublicos();

  return (
    <>
      <PageHeader
        eyebrow="Editais"
        title="Editais com inscrições abertas"
        description="Programas de iniciação científica e tecnológica com bolsas disponíveis por subárea do conhecimento."
        actions={
          <ButtonLink to="/pesquisas" variant="secondary">
            Ver pesquisas aprovadas
          </ButtonLink>
        }
      />

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : editais.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="Nenhum edital aberto no momento"
          description="Novos editais são publicados ao longo do ano. Crie uma conta para ser avisado quando o próximo abrir."
          action={<ButtonLink to="/cadastro">Criar conta</ButtonLink>}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {editais.map((e) => (
            <EditalCard key={e.id} edital={e} />
          ))}
        </div>
      )}
    </>
  );
}
