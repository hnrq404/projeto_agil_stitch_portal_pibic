import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardCheck, Pencil, Send, Square, Trophy } from 'lucide-react';

import { errorMessage } from '@/shared/api/http';
import { formatDate, formatDateTime, formatNota } from '@/shared/lib/format';
import { BOLSA_LABEL, EDITAL_STATUS } from '@/shared/lib/labels';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/Dialog';
import { ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { useEdital, useTransicaoEdital } from './api';

/** Detalhe administrativo do edital com o ciclo RASCUNHO → PUBLICADO → ENCERRADO. */
export function EditalGestorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: edital, isPending, isError, error, refetch } = useEdital(id);
  const transicao = useTransicaoEdital();
  const toast = useToast();
  const [confirmar, setConfirmar] = useState<'publicar' | 'encerrar' | null>(null);

  if (isPending) return <LoadingState label="Carregando edital..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const prazoVencido = new Date(edital.dataFimInscricoes).getTime() < Date.now();

  async function executar() {
    if (!confirmar || !edital) return;
    try {
      await transicao.mutateAsync({ id: edital.id, acao: confirmar });
      toast.success(confirmar === 'publicar' ? 'Edital publicado. Inscrições abertas.' : 'Edital encerrado.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setConfirmar(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={<Code>{edital.numero}</Code>}
        title={edital.titulo}
        back={{ to: '/gestor/editais', label: 'Editais' }}
        actions={
          <>
            {edital.status === 'RASCUNHO' && (
              <>
                <ButtonLink to={`/gestor/editais/${edital.id}/editar`} variant="secondary" icon={<Pencil className="h-4 w-4" aria-hidden />}>
                  Editar
                </ButtonLink>
                <Button variant="success" icon={<Send className="h-4 w-4" aria-hidden />} onClick={() => setConfirmar('publicar')}>
                  Publicar
                </Button>
              </>
            )}
            {edital.status === 'PUBLICADO' && (
              <Button
                variant="secondary"
                icon={<Square className="h-4 w-4" aria-hidden />}
                onClick={() => setConfirmar('encerrar')}
                disabled={!prazoVencido}
                title={prazoVencido ? undefined : 'Disponível após o fim do prazo de inscrições'}
              >
                Encerrar
              </Button>
            )}
            {edital.status !== 'RASCUNHO' && (
              <>
                <ButtonLink to={`/triagem?edital=${edital.id}`} variant="secondary" icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}>
                  Propostas
                </ButtonLink>
                <ButtonLink to={`/triagem/ranking/${edital.id}`} icon={<Trophy className="h-4 w-4" aria-hidden />}>
                  Ranking
                </ButtonLink>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Dados do edital" actions={<StatusBadge status={EDITAL_STATUS[edital.status]} />} />
          <div className="space-y-5 p-5">
            {edital.descricao && <p className="text-sm leading-relaxed text-ink-muted">{edital.descricao}</p>}
            <dl className="grid gap-4 sm:grid-cols-3">
              <DataItem label="Tipo de bolsa">{BOLSA_LABEL[edital.tipoBolsa]}</DataItem>
              <DataItem label="Total de bolsas">
                <span className="tnum">{edital.totalCotas}</span>
              </DataItem>
              <DataItem label="Nota de corte">
                <span className="tnum">{formatNota(edital.notaCorte)}</span>
              </DataItem>
              <DataItem label="Início das inscrições">{formatDate(edital.dataInicioInscricoes)}</DataItem>
              <DataItem label="Fim das inscrições">{formatDate(edital.dataFimInscricoes)}</DataItem>
              <DataItem label="Publicado em">{formatDateTime(edital.publicadoEm)}</DataItem>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Cotas por subárea CNPq" />
          <ul className="divide-y divide-line">
            {edital.cotas.map((c) => (
              <li key={c.subareaCode} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-mono text-xs text-ink-subtle">{c.subareaCode}</span>{' '}
                  <span className="text-ink">{c.subareaNome}</span>
                </span>
                <span className="font-semibold tnum">{c.quantidade}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmar !== null}
        title={confirmar === 'publicar' ? `Publicar o edital ${edital.numero}?` : `Encerrar o edital ${edital.numero}?`}
        description={
          confirmar === 'publicar'
            ? 'As inscrições serão abertas e todos os usuários receberão uma notificação. Depois de publicado, o edital não pode mais ser editado.'
            : 'O edital deixa de aparecer na vitrine de editais abertos. Um edital encerrado não pode ser reaberto (RN01).'
        }
        confirmLabel={confirmar === 'publicar' ? 'Publicar' : 'Encerrar'}
        tone={confirmar === 'publicar' ? 'success' : 'danger'}
        loading={transicao.isPending}
        onConfirm={() => void executar()}
        onCancel={() => setConfirmar(null)}
      />
    </>
  );
}
