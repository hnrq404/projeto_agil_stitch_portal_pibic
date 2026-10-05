import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Pencil, X } from 'lucide-react';

import { useCurrentUser } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { INSCRICAO_STATUS, VINCULO_STATUS } from '@/shared/lib/labels';
import type { Inscricao, InscricaoStatus } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Alert, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { Field, Textarea } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { useInscricao, useResponderVinculo } from './api';
import { PropostaConteudo } from './PropostaConteudo';

const TRILHA: { status: InscricaoStatus[]; label: string }[] = [
  { status: ['RASCUNHO'], label: 'Rascunho' },
  { status: ['SUBMETIDA'], label: 'Submetida' },
  { status: ['EM_AVALIACAO'], label: 'Em avaliação' },
  { status: ['AVALIADA'], label: 'Avaliada' },
  { status: ['APROVADA', 'RECUSADA'], label: 'Resultado' },
];

/** Linha do tempo do status atual (S3.4: status visível a qualquer momento). */
function TrilhaStatus({ status }: { status: InscricaoStatus }) {
  const atual = TRILHA.findIndex((t) => t.status.includes(status));
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Andamento da inscrição">
      {TRILHA.map((t, i) => (
        <li key={t.label} className="space-y-1.5" aria-current={i === atual ? 'step' : undefined}>
          <span
            className={cn(
              'block h-1.5 rounded-full',
              i < atual && 'bg-secondary',
              i === atual && (status === 'RECUSADA' ? 'bg-danger-500' : 'bg-primary'),
              i > atual && 'bg-slate-200',
            )}
          />
          <span className={cn('block text-xs', i === atual ? 'font-semibold text-ink' : 'text-ink-subtle')}>
            {i === TRILHA.length - 1 && i === atual ? INSCRICAO_STATUS[status].label : t.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function InscricaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const { data: inscricao, isPending, isError, error, refetch } = useInscricao(id);

  if (isPending) return <LoadingState label="Carregando inscrição..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const souDono = inscricao.discente?.id === user.id;
  const souOrientador = inscricao.orientador?.id === user.id;
  const voltar =
    user.role === 'DOCENTE'
      ? { to: '/orientacoes', label: 'Orientações' }
      : user.role === 'DISCENTE'
        ? { to: '/inscricoes', label: 'Minhas inscrições' }
        : user.role === 'AVALIADOR'
          ? { to: '/avaliacoes', label: 'Minhas avaliações' }
          : { to: '/triagem', label: 'Central de triagem' };

  return (
    <>
      <PageHeader
        eyebrow={inscricao.protocolo ? <Code>{inscricao.protocolo}</Code> : 'Rascunho'}
        title={inscricao.titulo || 'Proposta sem título'}
        back={voltar}
        actions={
          <>
            {souDono && inscricao.status === 'RASCUNHO' && (
              <ButtonLink to={`/inscricoes/${inscricao.id}/editar`} icon={<Pencil className="h-4 w-4" aria-hidden />}>
                Continuar preenchimento
              </ButtonLink>
            )}
            {inscricao.status === 'APROVADA' && (souDono || souOrientador) && (
              <ButtonLink to={`/projetos/${inscricao.id}`}>Abrir projeto</ButtonLink>
            )}
            {user.role === 'GESTOR' || user.role === 'ADMIN' ? (
              <ButtonLink to={`/triagem/${inscricao.id}`} variant="secondary">
                Abrir na triagem
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Situação</h2>
              <StatusBadge status={INSCRICAO_STATUS[inscricao.status]} />
            </div>
            <TrilhaStatus status={inscricao.status} />
            <ResultadoOuVinculo inscricao={inscricao} souOrientador={souOrientador} />
          </Card>

          <Card>
            <CardHeader title="Proposta" />
            <div className="p-5">
              <PropostaConteudo inscricao={inscricao} />
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Informações" />
          <dl className="space-y-4 p-5">
            {inscricao.edital && (
              <DataItem label="Edital">
                {inscricao.edital.numero}, {inscricao.edital.titulo}
              </DataItem>
            )}
            <DataItem label="Discente">{inscricao.discente?.nome ?? '-'}</DataItem>
            <DataItem label="Orientador(a)">
              {inscricao.orientador
                ? `${inscricao.orientador.nome}${inscricao.orientador.departamento ? ` (${inscricao.orientador.departamento})` : ''}`
                : 'Não indicado'}
            </DataItem>
            {inscricao.vinculoStatus && (
              <DataItem label="Vínculo">
                <StatusBadge status={VINCULO_STATUS[inscricao.vinculoStatus]} />
              </DataItem>
            )}
            <DataItem label="Submetida em">{formatDateTime(inscricao.submetidaEm)}</DataItem>
            <DataItem label="Última atualização">{formatDate(inscricao.atualizadoEm)}</DataItem>
          </dl>
        </Card>
      </div>
    </>
  );
}

function ResultadoOuVinculo({ inscricao, souOrientador }: { inscricao: Inscricao; souOrientador: boolean }) {
  if (inscricao.status === 'APROVADA') {
    return (
      <Alert tone="success" title="Proposta aprovada" className="mt-5">
        {inscricao.homologacaoJustificativa && <p>{inscricao.homologacaoJustificativa}</p>}
        <p>Homologada em {formatDate(inscricao.homologadaEm)}.</p>
      </Alert>
    );
  }
  if (inscricao.status === 'RECUSADA') {
    return (
      <Alert tone="danger" title="Proposta não aprovada" className="mt-5">
        <p>{inscricao.homologacaoJustificativa}</p>
      </Alert>
    );
  }
  if (inscricao.vinculoStatus === 'RECUSADO') {
    return (
      <Alert tone="warning" title="O orientador recusou o vínculo" className="mt-5">
        <p>Motivo: {inscricao.vinculoComentario}</p>
      </Alert>
    );
  }
  if (inscricao.status === 'SUBMETIDA' && inscricao.vinculoStatus === 'PENDENTE') {
    return souOrientador ? (
      <ResponderVinculo inscricao={inscricao} />
    ) : (
      <Alert tone="info" title="Aguardando o orientador" className="mt-5">
        O orientador indicado precisa confirmar o vínculo para a proposta seguir à triagem.
      </Alert>
    );
  }
  return null;
}

/** Ação do orientador: confirmar ou recusar (com motivo) a orientação. */
function ResponderVinculo({ inscricao }: { inscricao: Inscricao }) {
  const responder = useResponderVinculo(inscricao.id);
  const toast = useToast();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');

  async function enviar(decisao: 'CONFIRMAR' | 'RECUSAR') {
    try {
      await responder.mutateAsync({ decisao, comentario: decisao === 'RECUSAR' ? motivo : undefined });
      toast.success(decisao === 'CONFIRMAR' ? 'Orientação confirmada.' : 'Orientação recusada. O discente foi avisado.');
      setRecusando(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-warning-200 bg-warning-50 p-4">
      <p className="font-semibold text-warning-900">{inscricao.discente?.nome} indicou você como orientador(a).</p>
      <p className="mt-1 text-sm text-warning-900">
        Leia a proposta e os documentos abaixo. Ao confirmar, a proposta segue para a Central de Triagem.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="success"
          icon={<Check className="h-4 w-4" aria-hidden />}
          loading={responder.isPending && responder.variables?.decisao === 'CONFIRMAR'}
          onClick={() => void enviar('CONFIRMAR')}
        >
          Confirmar orientação
        </Button>
        <Button variant="danger" icon={<X className="h-4 w-4" aria-hidden />} onClick={() => setRecusando(true)}>
          Recusar
        </Button>
      </div>

      <Dialog
        open={recusando}
        onClose={() => setRecusando(false)}
        title="Recusar orientação"
        description="A inscrição volta para rascunho e o discente poderá indicar outro orientador."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecusando(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={motivo.trim().length < 5}
              loading={responder.isPending}
              onClick={() => void enviar('RECUSAR')}
            >
              Recusar orientação
            </Button>
          </>
        }
      >
        <Field label="Motivo (enviado ao discente)" required>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
