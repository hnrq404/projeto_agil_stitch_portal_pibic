import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, FileText, Undo2 } from 'lucide-react';

import { useCurrentUser } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/shared/api/http';
import { diasAte, formatBytes, formatDate, formatDateTime } from '@/shared/lib/format';
import { RELATORIO_STATUS, SITUACAO_RELATORIO } from '@/shared/lib/labels';
import type { ProjetoDetalhe, Relatorio, RelatorioTipo } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { FileDropzone } from '@/shared/ui/FileDropzone';
import { Field, Textarea } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { abrirPdf } from '@/shared/ui/PdfViewer';
import { useToast } from '@/shared/ui/Toast';

import { relatorioUrl, useAvaliarRelatorio, useEnviarRelatorio, useProjeto } from './api';

const TIPO_LABEL: Record<RelatorioTipo, string> = { PARCIAL: 'Relatório parcial', FINAL: 'Relatório final' };

/** RF19–RF21: projeto aprovado, prazos dos relatórios, versões e histórico do bolsista. */
export function ProjetoPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError, error, refetch } = useProjeto(id);

  if (isPending) return <LoadingState label="Carregando projeto..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { projeto } = data;
  return (
    <>
      <PageHeader
        eyebrow={<Code>{projeto.protocolo ?? '-'}</Code>}
        title={projeto.titulo}
        back={{ to: '/projetos', label: 'Projetos' }}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {data.acompanhamento.map((a) => (
              <CardRelatorio key={a.tipo} detalhe={data} tipo={a.tipo} />
            ))}
          </div>
          <HistoricoRelatorios detalhe={data} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Projeto" />
            <dl className="grid gap-4 p-5">
              <DataItem label="Bolsista">{projeto.discente?.nome}</DataItem>
              <DataItem label="Orientador(a)">{projeto.orientador?.nome}</DataItem>
              <DataItem label="Edital">
                {projeto.edital?.numero}, {projeto.edital?.titulo}
              </DataItem>
              <DataItem label="Subárea">{projeto.subareaNome}</DataItem>
              <DataItem label="Aprovado em">{formatDate(projeto.homologadaEm)}</DataItem>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Histórico" />
            <ol className="space-y-4 p-5">
              {data.timeline.map((e, i) => (
                <li key={`${e.data}-${i}`} className="relative border-l-2 border-line pl-4">
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-secondary" aria-hidden />
                  <p className="text-sm font-semibold text-ink">{e.titulo}</p>
                  <p className="text-xs text-ink-subtle">{formatDateTime(e.data)}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{e.descricao}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

function CardRelatorio({ detalhe, tipo }: { detalhe: ProjetoDetalhe; tipo: RelatorioTipo }) {
  const user = useCurrentUser();
  const enviar = useEnviarRelatorio(detalhe.projeto.id);
  const toast = useToast();
  const acomp = detalhe.acompanhamento.find((a) => a.tipo === tipo);
  if (!acomp) return null;

  const souBolsista = detalhe.projeto.discente?.id === user.id;
  const parcialAprovado = detalhe.acompanhamento.some((a) => a.tipo === 'PARCIAL' && a.situacao === 'APROVADO');
  const podeEnviar =
    souBolsista &&
    ['AGUARDANDO_ENVIO', 'ATRASADO', 'DEVOLVIDO'].includes(acomp.situacao) &&
    (tipo === 'PARCIAL' || parcialAprovado);
  const dias = diasAte(acomp.prazo);

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{TIPO_LABEL[tipo]}</h2>
        <StatusBadge status={SITUACAO_RELATORIO[acomp.situacao]} />
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Prazo: {formatDate(acomp.prazo)}
        {acomp.situacao !== 'APROVADO' && (dias >= 0 ? ` (faltam ${dias} dias)` : ` (vencido há ${-dias} dias)`)}
      </p>
      {tipo === 'FINAL' && !parcialAprovado && souBolsista && (
        <p className="mt-3 text-sm text-ink-subtle">Disponível depois da aprovação do relatório parcial.</p>
      )}
      {podeEnviar && (
        <div className="mt-4">
          <FileDropzone
            label={acomp.situacao === 'DEVOLVIDO' ? 'Enviar nova versão' : 'Enviar relatório'}
            onUpload={async (file, onProgress) => {
              await enviar.mutateAsync({ tipo, file, onProgress });
              toast.success('Relatório enviado. Seu orientador foi avisado.');
            }}
          />
        </div>
      )}
    </Card>
  );
}

function HistoricoRelatorios({ detalhe }: { detalhe: ProjetoDetalhe }) {
  const user = useCurrentUser();
  const toast = useToast();
  const souOrientador = detalhe.projeto.orientador?.id === user.id;
  const [avaliando, setAvaliando] = useState<{ relatorio: Relatorio; decisao: 'APROVAR' | 'DEVOLVER' } | null>(null);

  if (detalhe.relatorios.length === 0) {
    return (
      <Card className="p-5 text-sm text-ink-muted">Nenhum relatório enviado ainda.</Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Relatórios enviados" description="Todas as versões ficam registradas." />
      <ul className="divide-y divide-line">
        {[...detalhe.relatorios].reverse().map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                {TIPO_LABEL[r.tipo]}, versão {r.versao}
              </p>
              <p className="text-xs text-ink-subtle">
                {r.nome}, {formatBytes(r.tamanho)}, enviado em {formatDateTime(r.enviadoEm)}
              </p>
              {r.comentarioOrientador && (
                <p className="mt-2 rounded bg-canvas px-3 py-2 text-sm text-ink">
                  <span className="font-medium">Orientador:</span> {r.comentarioOrientador}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={RELATORIO_STATUS[r.status]} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void abrirPdf(relatorioUrl(detalhe.projeto.id, r.id)).catch((e) => toast.error(errorMessage(e)))}
              >
                Abrir
              </Button>
              {souOrientador && r.status === 'ENVIADO' && (
                <>
                  <Button size="sm" variant="success" icon={<Check className="h-4 w-4" aria-hidden />} onClick={() => setAvaliando({ relatorio: r, decisao: 'APROVAR' })}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="danger" icon={<Undo2 className="h-4 w-4" aria-hidden />} onClick={() => setAvaliando({ relatorio: r, decisao: 'DEVOLVER' })}>
                    Devolver
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {avaliando && (
        <AvaliarRelatorioDialog
          projetoId={detalhe.projeto.id}
          relatorio={avaliando.relatorio}
          decisao={avaliando.decisao}
          onClose={() => setAvaliando(null)}
        />
      )}
    </Card>
  );
}

function AvaliarRelatorioDialog({
  projetoId,
  relatorio,
  decisao,
  onClose,
}: {
  projetoId: string;
  relatorio: Relatorio;
  decisao: 'APROVAR' | 'DEVOLVER';
  onClose: () => void;
}) {
  const avaliar = useAvaliarRelatorio(projetoId);
  const toast = useToast();
  const [comentario, setComentario] = useState('');
  const devolver = decisao === 'DEVOLVER';

  async function enviar() {
    try {
      await avaliar.mutateAsync({ relatorioId: relatorio.id, decisao, comentario });
      toast.success(devolver ? 'Relatório devolvido ao bolsista.' : 'Relatório aprovado.');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={devolver ? 'Devolver para correção' : 'Aprovar relatório'}
      description={`${TIPO_LABEL[relatorio.tipo]}, versão ${relatorio.versao}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={devolver ? 'danger' : 'success'}
            disabled={devolver && comentario.trim().length < 10}
            loading={avaliar.isPending}
            onClick={() => void enviar()}
          >
            {devolver ? 'Devolver' : 'Aprovar'}
          </Button>
        </>
      }
    >
      <Field
        label={devolver ? 'O que precisa ser corrigido' : 'Comentário'}
        hint={devolver ? 'Obrigatório, mínimo de 10 caracteres.' : 'Opcional.'}
        required={devolver}
      >
        <Textarea rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      </Field>
    </Dialog>
  );
}
