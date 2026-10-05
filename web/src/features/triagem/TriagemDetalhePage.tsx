import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, UserPlus, X } from 'lucide-react';

import { useCriterios } from '@/features/avaliacoes/api';
import { LIMIAR_DIVERGENCIA } from '@/features/avaliacoes/rubrica';
import { PropostaConteudo } from '@/features/inscricoes/PropostaConteudo';
import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatNota } from '@/shared/lib/format';
import { INSCRICAO_STATUS, VINCULO_STATUS } from '@/shared/lib/labels';
import type { Avaliacao, Inscricao, ItemTriagem } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/Dialog';
import { Alert, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { Field, Textarea } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { useAtribuirAvaliadores, useAvaliadores, useHomologar, useItemTriagem, useRemoverAtribuicao } from './api';

const MAX_AVALIADORES = 3;

export function TriagemDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { data: item, isPending, isError, error, refetch } = useItemTriagem(id);

  if (isPending) return <LoadingState label="Carregando proposta..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { inscricao } = item;
  return (
    <>
      <PageHeader
        eyebrow={<Code>{inscricao.protocolo ?? 'Sem protocolo'}</Code>}
        title={inscricao.titulo}
        back={{ to: `/triagem${inscricao.edital ? `?edital=${inscricao.edital.id}` : ''}`, label: 'Central de triagem' }}
        actions={<StatusBadge status={INSCRICAO_STATUS[inscricao.status]} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Proposta" />
            <div className="p-5">
              <PropostaConteudo inscricao={inscricao} />
            </div>
          </Card>
          <Pareceres avaliacoes={item.avaliacoes} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pessoas" />
            <dl className="grid gap-4 p-5">
              <DataItem label="Discente">{inscricao.discente?.nome}</DataItem>
              <DataItem label="Orientador(a)">
                {inscricao.orientador?.nome}
                {inscricao.orientador?.departamento && <Code className="ml-2">{inscricao.orientador.departamento}</Code>}
              </DataItem>
              {inscricao.vinculoStatus && (
                <DataItem label="Vínculo">
                  <StatusBadge status={VINCULO_STATUS[inscricao.vinculoStatus]} />
                </DataItem>
              )}
              <DataItem label="Edital">
                {inscricao.edital?.numero}, nota de corte {formatNota(inscricao.edital?.notaCorte)}
              </DataItem>
            </dl>
          </Card>
          <Consolidacao item={item} />
          <Atribuicao item={item} />
          <Homologacao inscricao={inscricao} />
        </div>
      </div>
    </>
  );
}

function Consolidacao({ item }: { item: ItemTriagem }) {
  const { consolidado } = item;
  if (consolidado.total === 0) return null;
  return (
    <Card>
      <CardHeader title="Consolidado" description={`${consolidado.concluidas} de ${consolidado.total} pareceres concluídos`} />
      <div className="space-y-4 p-5">
        <dl className="grid grid-cols-3 gap-3 text-center">
          <DataItem label="Média">
            <span className="font-display text-2xl font-bold tnum">{formatNota(consolidado.media)}</span>
          </DataItem>
          <DataItem label="Menor">
            <span className="text-lg font-semibold tnum">{formatNota(consolidado.menor)}</span>
          </DataItem>
          <DataItem label="Maior">
            <span className="text-lg font-semibold tnum">{formatNota(consolidado.maior)}</span>
          </DataItem>
        </dl>
        {consolidado.divergente && (
          <Alert tone="warning" title="Divergência entre avaliadores (RN08)">
            As notas diferem em mais de {LIMIAR_DIVERGENCIA} pontos. Considere atribuir mais um avaliador antes de homologar.
          </Alert>
        )}
      </div>
    </Card>
  );
}

function Atribuicao({ item }: { item: ItemTriagem }) {
  const { inscricao, avaliacoes } = item;
  const avaliadores = useAvaliadores();
  const atribuir = useAtribuirAvaliadores(inscricao.id);
  const remover = useRemoverAtribuicao();
  const toast = useToast();
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const podeAtribuir =
    (inscricao.status === 'SUBMETIDA' || inscricao.status === 'EM_AVALIACAO') && inscricao.vinculoStatus === 'CONFIRMADO';
  const vagas = MAX_AVALIADORES - avaliacoes.length;
  const jaAtribuidos = new Set(avaliacoes.map((a) => a.avaliador.id));
  const deptOrientador = inscricao.orientador?.departamento;

  if (!podeAtribuir && avaliacoes.length === 0) {
    return inscricao.status === 'SUBMETIDA' ? (
      <Alert tone="info" title="Aguardando o orientador">
        A distribuição fica disponível depois que o orientador confirmar o vínculo.
      </Alert>
    ) : null;
  }

  async function enviar() {
    try {
      await atribuir.mutateAsync(selecionados);
      toast.success('Avaliadores atribuídos e notificados.');
      setSelecionados([]);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader title="Avaliadores" description={`Até ${MAX_AVALIADORES} por proposta`} />
      <div className="space-y-4 p-5">
        {avaliacoes.length > 0 && (
          <ul className="space-y-2">
            {avaliacoes.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-ink">{a.avaliador.nome}</span>
                  <span className="block text-xs text-ink-subtle">
                    {a.status === 'CONCLUIDA' ? `Nota ${formatNota(a.notaFinal)}` : 'Parecer pendente'}
                  </span>
                </span>
                {a.status === 'PENDENTE' && podeAtribuir && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remover ${a.avaliador.nome}`}
                    icon={<X className="h-4 w-4" aria-hidden />}
                    loading={remover.isPending && remover.variables === a.id}
                    onClick={() => remover.mutate(a.id, { onError: (e) => toast.error(errorMessage(e)) })}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {podeAtribuir && vagas > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-ink">Atribuir avaliadores</legend>
            {avaliadores.isPending && <p className="text-sm text-ink-muted">Carregando avaliadores...</p>}
            {avaliadores.data?.length === 0 && (
              <p className="text-sm text-ink-muted">Nenhum avaliador cadastrado. Promova usuários em Usuários.</p>
            )}
            {avaliadores.data
              ?.filter((av) => !jaAtribuidos.has(av.id))
              .map((av) => {
                const conflito = Boolean(deptOrientador && av.departamento === deptOrientador);
                const marcado = selecionados.includes(av.id);
                const lotado = !marcado && selecionados.length >= vagas;
                return (
                  <label
                    key={av.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border px-3 py-2 text-sm',
                      conflito ? 'cursor-not-allowed border-line bg-canvas opacity-70' : 'cursor-pointer border-line hover:border-line-strong',
                      marcado && 'border-primary bg-primary-soft',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[#0F294A]"
                      disabled={conflito || lotado}
                      checked={marcado}
                      onChange={(e) =>
                        setSelecionados((s) => (e.target.checked ? [...s, av.id] : s.filter((x) => x !== av.id)))
                      }
                    />
                    <span className="flex-1">
                      <span className="block font-medium text-ink">{av.nome}</span>
                      <span className="block text-xs text-ink-subtle">
                        {av.departamento || 'Sem departamento'}, {av.pendentes} pendente(s)
                      </span>
                      {conflito && (
                        <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-800">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                          Conflito: mesmo departamento do orientador
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            <Button
              className="w-full"
              icon={<UserPlus className="h-4 w-4" aria-hidden />}
              disabled={selecionados.length === 0}
              loading={atribuir.isPending}
              onClick={() => void enviar()}
            >
              Atribuir {selecionados.length > 0 ? `(${selecionados.length})` : ''}
            </Button>
          </fieldset>
        )}
      </div>
    </Card>
  );
}

function Homologacao({ inscricao }: { inscricao: Inscricao }) {
  const homologar = useHomologar(inscricao.id);
  const toast = useToast();
  const [decisao, setDecisao] = useState<'APROVAR' | 'RECUSAR' | null>(null);
  const [justificativa, setJustificativa] = useState('');

  if (inscricao.status === 'APROVADA' || inscricao.status === 'RECUSADA') {
    return (
      <Alert tone={inscricao.status === 'APROVADA' ? 'success' : 'danger'} title={`Homologada em ${formatDate(inscricao.homologadaEm)}`}>
        {inscricao.homologacaoJustificativa ?? INSCRICAO_STATUS[inscricao.status].label}
      </Alert>
    );
  }
  if (inscricao.status !== 'AVALIADA') return null;

  async function confirmar() {
    if (!decisao) return;
    try {
      await homologar.mutateAsync({ decisao, justificativa });
      toast.success(decisao === 'APROVAR' ? 'Proposta aprovada. Discente e orientador foram notificados.' : 'Resultado registrado e comunicado.');
      setDecisao(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader title="Homologação" description="Decisão final, comunicada ao discente e ao orientador." />
      <div className="flex flex-col gap-2 p-5">
        <Button variant="success" icon={<Check className="h-4 w-4" aria-hidden />} onClick={() => setDecisao('APROVAR')}>
          Aprovar e atribuir bolsa
        </Button>
        <Button variant="danger" icon={<X className="h-4 w-4" aria-hidden />} onClick={() => setDecisao('RECUSAR')}>
          Não aprovar
        </Button>
      </div>
      <ConfirmDialog
        open={decisao !== null}
        title={decisao === 'APROVAR' ? 'Aprovar a proposta?' : 'Registrar não aprovação?'}
        description={
          decisao === 'APROVAR'
            ? 'A bolsa é descontada da cota da subárea. A aprovação não pode ser desfeita.'
            : 'A justificativa será enviada ao discente e ao orientador.'
        }
        confirmLabel={decisao === 'APROVAR' ? 'Aprovar' : 'Registrar'}
        tone={decisao === 'APROVAR' ? 'success' : 'danger'}
        loading={homologar.isPending}
        onConfirm={() => void confirmar()}
        onCancel={() => setDecisao(null)}
      >
        <Field label="Justificativa" hint={decisao === 'RECUSAR' ? 'Obrigatória, mínimo de 10 caracteres.' : 'Opcional.'} required={decisao === 'RECUSAR'}>
          <Textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}

/** Pareceres emitidos, com nota por critério (transparência do processo). */
export function Pareceres({ avaliacoes }: { avaliacoes: Avaliacao[] }) {
  const criterios = useCriterios();
  const nomeDe = (id: string) => criterios.data?.find((c) => c.id === id)?.nome ?? id;
  const concluidas = avaliacoes.filter((a) => a.status === 'CONCLUIDA');
  if (concluidas.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Pareceres" />
      <ul className="divide-y divide-line">
        {concluidas.map((a) => (
          <li key={a.id} className="space-y-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{a.avaliador.nome}</p>
              <p className="text-sm text-ink-muted">
                Nota final <strong className="text-ink tnum">{formatNota(a.notaFinal)}</strong>
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {a.notas.map((n) => (
                <li key={n.criterio} className="flex justify-between rounded bg-canvas px-3 py-1.5 text-sm">
                  <span className="text-ink-muted">{nomeDe(n.criterio)}</span>
                  <span className="font-semibold tnum">{n.nota}</span>
                </li>
              ))}
            </ul>
            {a.parecer && <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{a.parecer}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
