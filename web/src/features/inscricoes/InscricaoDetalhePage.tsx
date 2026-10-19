import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, Pencil, Send, UserCheck, Users } from 'lucide-react';

import { useCurrentUser } from '@/features/auth/AuthProvider';
import { useAvaliadores } from '@/features/triagem/api';
import { ApiError, errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { CANDIDATURA_STATUS, INSCRICAO_STATUS } from '@/shared/lib/labels';
import type { Candidatura, Inscricao, InscricaoStatus } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/Dialog';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { Input } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { useCandidaturasDoProjeto, useEnviarAoEdital, useInscricao, useSelecionarAluno } from './api';
import { PropostaConteudo } from './PropostaConteudo';

/** Três professores avaliam cada projeto (indicados pelo dono no envio). */
const TOTAL_AVALIADORES = 3;

const TRILHA: { status: InscricaoStatus[]; label: string }[] = [
  { status: ['RASCUNHO'], label: 'Rascunho' },
  { status: ['DIVULGADA'], label: 'Divulgado' },
  { status: ['EM_AVALIACAO'], label: 'Em avaliação' },
  { status: ['AVALIADA'], label: 'Avaliado' },
  { status: ['APROVADA', 'RECUSADA'], label: 'Resultado' },
];

/** Linha do tempo do status atual (S3.4: status visível a qualquer momento). */
function TrilhaStatus({ status }: { status: InscricaoStatus }) {
  const atual = TRILHA.findIndex((t) => t.status.includes(status));
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Andamento do projeto">
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

  if (isPending) return <LoadingState label="Carregando projeto..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const souDono = inscricao.orientador?.id === user.id;
  const souAluno = inscricao.discente?.id === user.id;
  const editavel = inscricao.status === 'RASCUNHO' || inscricao.status === 'DIVULGADA';
  const voltar = souDono
    ? { to: '/inscricoes', label: 'Meus projetos' }
    : user.role === 'DOCENTE'
      ? { to: '/avaliacoes', label: 'Minhas avaliações' }
      : user.role === 'DISCENTE'
        ? { to: '/candidaturas', label: 'Minhas candidaturas' }
        : { to: '/triagem', label: 'Central de triagem' };

  return (
    <>
      <PageHeader
        eyebrow={inscricao.protocolo ? <Code>{inscricao.protocolo}</Code> : INSCRICAO_STATUS[inscricao.status].label}
        title={inscricao.titulo || 'Projeto sem título'}
        back={voltar}
        actions={
          <>
            {souDono && editavel && (
              <ButtonLink
                to={`/inscricoes/${inscricao.id}/editar`}
                variant={inscricao.status === 'RASCUNHO' ? 'primary' : 'secondary'}
                icon={<Pencil className="h-4 w-4" aria-hidden />}
              >
                {inscricao.status === 'RASCUNHO' ? 'Continuar escrevendo' : 'Editar projeto'}
              </ButtonLink>
            )}
            {inscricao.status === 'APROVADA' && (souDono || souAluno) && (
              <ButtonLink to={`/projetos/${inscricao.id}`}>Abrir projeto e relatórios</ButtonLink>
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
            <Situacao inscricao={inscricao} souDono={souDono} souAluno={souAluno} />
          </Card>

          {souDono && inscricao.status !== 'RASCUNHO' && <Candidatos inscricao={inscricao} />}
          {souDono && inscricao.status === 'DIVULGADA' && <EnvioAoEdital inscricao={inscricao} />}

          <Card>
            <CardHeader title="Projeto" />
            <div className="p-5">
              <PropostaConteudo inscricao={inscricao} mostrarAnexos={inscricao.status !== 'RASCUNHO' || souDono} />
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
            <DataItem label="Professor(a) orientador(a)">
              {inscricao.orientador
                ? `${inscricao.orientador.nome}${inscricao.orientador.departamento ? ` (${inscricao.orientador.departamento})` : ''}`
                : '-'}
            </DataItem>
            <DataItem label="Aluno(a) selecionado(a)">{inscricao.discente?.nome ?? 'Ainda não selecionado'}</DataItem>
            {inscricao.divulgadaEm && <DataItem label="Divulgado em">{formatDate(inscricao.divulgadaEm)}</DataItem>}
            {inscricao.submetidaEm && <DataItem label="Enviado ao edital em">{formatDateTime(inscricao.submetidaEm)}</DataItem>}
            <DataItem label="Última atualização">{formatDate(inscricao.atualizadoEm)}</DataItem>
          </dl>
        </Card>
      </div>
    </>
  );
}

function Situacao({ inscricao, souDono, souAluno }: { inscricao: Inscricao; souDono: boolean; souAluno: boolean }) {
  switch (inscricao.status) {
    case 'RASCUNHO':
      return souDono ? (
        <Alert tone="info" title="Divulgue o projeto aos alunos" className="mt-5">
          Termine de escrever e use "Divulgar aos alunos" na última etapa do formulário. Os alunos poderão se candidatar.
        </Alert>
      ) : null;
    case 'DIVULGADA':
      if (souAluno) {
        return (
          <Alert tone="success" title="Você foi selecionado(a) para este projeto" className="mt-5">
            O professor vai enviar o projeto ao edital. Você será avisado(a) do resultado.
          </Alert>
        );
      }
      return souDono ? (
        <Alert tone="info" title={inscricao.discente ? 'Aluno selecionado' : 'Recebendo candidaturas'} className="mt-5">
          {inscricao.discente
            ? `Você selecionou ${inscricao.discente.nome}. Anexe os documentos, indique três professores avaliadores e envie ao edital.`
            : 'Escolha o aluno entre os candidatos abaixo. Depois, indique três professores avaliadores e envie ao edital.'}
        </Alert>
      ) : null;
    case 'EM_AVALIACAO':
      return (
        <Alert tone="info" title="Em avaliação" className="mt-5">
          Três professores indicados estão avaliando o projeto. Depois dos pareceres, a gestão homologa o resultado.
        </Alert>
      );
    case 'AVALIADA':
      return (
        <Alert tone="info" title="Avaliação concluída" className="mt-5">
          Os três pareceres foram enviados. O projeto aguarda a homologação da gestão.
        </Alert>
      );
    case 'APROVADA':
      return (
        <Alert tone="success" title="Projeto aprovado" className="mt-5">
          {inscricao.homologacaoJustificativa && <p>{inscricao.homologacaoJustificativa}</p>}
          <p>Homologado em {formatDate(inscricao.homologadaEm)}. O relatório mensal do bolsista vence todo dia 5.</p>
        </Alert>
      );
    case 'RECUSADA':
      return (
        <Alert tone="danger" title="Projeto não aprovado" className="mt-5">
          <p>{inscricao.homologacaoJustificativa}</p>
        </Alert>
      );
  }
}

/** Candidatos ao projeto; enquanto divulgado, o professor escolhe o aluno. */
function Candidatos({ inscricao }: { inscricao: Inscricao }) {
  const { data, isPending, isError, error, refetch } = useCandidaturasDoProjeto(inscricao.id, true);
  const selecionar = useSelecionarAluno(inscricao.id);
  const toast = useToast();
  const podeSelecionar = inscricao.status === 'DIVULGADA';

  async function escolher(c: Candidatura) {
    try {
      await selecionar.mutateAsync(c.id);
      toast.success(`${c.discente?.nome ?? 'Aluno'} selecionado(a). O aluno foi avisado.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader
        title="Candidatos"
        description={podeSelecionar ? 'Leia a apresentação de cada aluno e escolha quem fará o projeto.' : undefined}
      />
      <div className="p-5">
        {isPending ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Nenhuma candidatura ainda"
            description="Os alunos foram avisados da divulgação. As candidaturas aparecem aqui e nas suas notificações."
          />
        ) : (
          <ul className="divide-y divide-line">
            {data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.discente?.nome ?? 'Aluno removido'}</p>
                  <p className="text-sm text-ink-muted">
                    {[c.discente?.departamento, c.discente?.matricula && `matrícula ${c.discente.matricula}`, c.discente?.email]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink">{c.mensagem}</p>
                  <p className="mt-1 text-xs text-ink-subtle">Candidatura em {formatDate(c.criadoEm)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={CANDIDATURA_STATUS[c.status]} />
                  {podeSelecionar && c.status === 'PENDENTE' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<UserCheck className="h-4 w-4" aria-hidden />}
                      loading={selecionar.isPending && selecionar.variables === c.id}
                      onClick={() => void escolher(c)}
                    >
                      Selecionar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Professor indica três colegas como avaliadores e envia o projeto ao edital. */
function EnvioAoEdital({ inscricao }: { inscricao: Inscricao }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const avaliadores = useAvaliadores();
  const enviar = useEnviarAoEdital(inscricao.id);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; pendencias: string[] } | null>(null);

  const colegas = useMemo(() => (avaliadores.data ?? []).filter((d) => d.id !== user.id), [avaliadores.data, user.id]);
  const termo = busca.trim().toLowerCase();
  const visiveis = colegas.filter(
    (d) => !termo || `${d.nome} ${d.departamento}`.toLowerCase().includes(termo) || selecionados.includes(d.id),
  );
  const pendencias = inscricao.pendencias ?? [];
  const completo = selecionados.length === TOTAL_AVALIADORES;
  const nomes = colegas.filter((d) => selecionados.includes(d.id)).map((d) => d.nome);

  function alternar(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : atual.length < TOTAL_AVALIADORES ? [...atual, id] : atual,
    );
  }

  async function confirmarEnvio() {
    setErro(null);
    try {
      await enviar.mutateAsync(selecionados);
      toast.success('Projeto enviado ao edital. Os avaliadores e o aluno foram avisados.');
      setConfirmar(false);
      navigate(`/inscricoes/${inscricao.id}`, { replace: true });
    } catch (e) {
      setConfirmar(false);
      setErro({ mensagem: errorMessage(e), pendencias: e instanceof ApiError ? e.pendencias : [] });
    }
  }

  return (
    <Card>
      <CardHeader
        title="Enviar ao edital"
        description={`Indique ${TOTAL_AVALIADORES} professores para avaliar o projeto. Você não pode avaliar o próprio projeto.`}
      />
      <div className="space-y-5 p-5">
        {erro && (
          <Alert tone="danger" title={erro.mensagem}>
            {erro.pendencias.length > 0 && (
              <ul className="list-disc pl-5">
                {erro.pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        {pendencias.length > 0 && (
          <Alert tone="warning" title="Antes de enviar, ainda falta">
            <ul className="space-y-1">
              {pendencias.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <fieldset>
          <legend className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-semibold">
            <span>Professores avaliadores</span>
            <span className={cn('tnum', completo ? 'text-success-700' : 'text-ink-muted')}>
              {selecionados.length} de {TOTAL_AVALIADORES}
            </span>
          </legend>
          <Input
            type="search"
            placeholder="Buscar por nome ou departamento"
            aria-label="Buscar professor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-3"
          />
          {avaliadores.isPending ? (
            <LoadingState label="Carregando professores..." />
          ) : avaliadores.isError ? (
            <ErrorState error={avaliadores.error} onRetry={() => void avaliadores.refetch()} />
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
              {visiveis.map((d) => {
                const marcado = selecionados.includes(d.id);
                const bloqueado = !marcado && completo;
                return (
                  <li key={d.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm',
                        marcado && 'bg-primary-soft',
                        bloqueado && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-[#0F294A]"
                        checked={marcado}
                        disabled={bloqueado}
                        onChange={() => alternar(d.id)}
                      />
                      <span className="flex-1">
                        <span className="font-medium text-ink">{d.nome}</span>
                        {d.departamento && <span className="text-ink-muted"> ({d.departamento})</span>}
                      </span>
                      <span className="text-xs text-ink-subtle">
                        {d.pendentes} avaliação(ões) pendente(s)
                      </span>
                    </label>
                  </li>
                );
              })}
              {visiveis.length === 0 && <li className="px-3 py-4 text-sm text-ink-muted">Nenhum professor encontrado.</li>}
            </ul>
          )}
        </fieldset>

        <div className="flex justify-end">
          <Button
            variant="success"
            icon={<Send className="h-4 w-4" aria-hidden />}
            disabled={!completo || pendencias.length > 0}
            onClick={() => setConfirmar(true)}
          >
            Enviar ao edital
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmar}
        title="Enviar o projeto ao edital?"
        description={`Depois do envio o projeto não pode mais ser editado (RN05). Avaliadores: ${nomes.join(', ')}. O aluno ${inscricao.discente?.nome ?? ''} e os candidatos não selecionados serão avisados.`}
        confirmLabel="Enviar"
        tone="success"
        loading={enviar.isPending}
        onConfirm={() => void confirmarEnvio()}
        onCancel={() => setConfirmar(false)}
      />
    </Card>
  );
}
