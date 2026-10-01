import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { anexoUrl } from '@/features/inscricoes/api';
import { PropostaConteudo } from '@/features/inscricoes/PropostaConteudo';
import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { formatDateTime, formatNota } from '@/shared/lib/format';
import { ANEXO_LABEL } from '@/shared/lib/labels';
import type { AvaliacaoDetalhe, Criterio } from '@/shared/types/api';
import { Code } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/Dialog';
import { Alert, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { CharCounter, Field, REQUIRED_MARK, Textarea } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { PdfViewer } from '@/shared/ui/PdfViewer';
import { useToast } from '@/shared/ui/Toast';

import { useAvaliacao, useEmitirParecer } from './api';
import { MIN_PARECER, mediaParcial, parecerObrigatorio, parecerValido, toNotas, type NotasParciais } from './rubrica';

const ESCALA = Array.from({ length: 11 }, (_, i) => i);

export function AvaliacaoPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError, error, refetch } = useAvaliacao(id);

  if (isPending) return <LoadingState label="Carregando proposta..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow={<Code>{data.inscricao.protocolo ?? '-'}</Code>}
        title={data.inscricao.titulo}
        description={`${data.inscricao.subareaNome}. Edital ${data.inscricao.edital?.numero}, nota de corte ${formatNota(data.inscricao.edital?.notaCorte)}.`}
        back={{ to: '/avaliacoes', label: 'Minhas avaliações' }}
      />
      {/* Painel duplo (RF15): documento à esquerda, rubrica à direita. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Documentos avaliacao={data} />
        <div className="xl:sticky xl:top-20 xl:self-start">
          {data.status === 'CONCLUIDA' ? <ParecerEnviado avaliacao={data} /> : <Rubrica avaliacao={data} />}
        </div>
      </div>
    </>
  );
}

function Documentos({ avaliacao }: { avaliacao: AvaliacaoDetalhe }) {
  const { inscricao } = avaliacao;
  const abas = [{ id: 'proposta', label: 'Proposta' }, ...inscricao.anexos.map((a) => ({ id: a.id, label: ANEXO_LABEL[a.tipo] }))];
  const [aba, setAba] = useState(inscricao.anexos[0]?.id ?? 'proposta');
  const anexo = inscricao.anexos.find((a) => a.id === aba);

  return (
    <Card className="min-w-0">
      <div role="tablist" aria-label="Documentos da proposta" className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-3">
        {abas.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`aba-${t.id}`}
            aria-selected={aba === t.id}
            aria-controls="painel-documento"
            onClick={() => setAba(t.id)}
            className={cn(
              '-mb-px whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition',
              aba === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id="painel-documento" role="tabpanel" aria-labelledby={`aba-${aba}`} className="p-5">
        {anexo ? (
          <PdfViewer src={anexoUrl(inscricao.id, anexo.id)} nome={anexo.nome} />
        ) : (
          <PropostaConteudo inscricao={inscricao} mostrarAnexos={false} />
        )}
      </div>
    </Card>
  );
}

function Rubrica({ avaliacao }: { avaliacao: AvaliacaoDetalhe }) {
  const navigate = useNavigate();
  const toast = useToast();
  const emitir = useEmitirParecer(avaliacao.id);
  const [notas, setNotas] = useState<NotasParciais>({});
  const [parecer, setParecer] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [tentou, setTentou] = useState(false);

  const ids = avaliacao.criterios.map((c) => c.id);
  const notaCorte = avaliacao.inscricao.edital?.notaCorte ?? 6;
  const media = mediaParcial(notas, ids);
  const obrigatorio = parecerObrigatorio(media, notaCorte);
  const completa = media !== null;
  const valido = completa && parecerValido(media, notaCorte, parecer);

  async function enviar() {
    try {
      await emitir.mutateAsync({ notas: toNotas(notas, ids), parecer });
      toast.success('Parecer enviado. Obrigado pela avaliação.');
      navigate('/avaliacoes');
    } catch (e) {
      setConfirmar(false);
      toast.error(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader title="Rubrica de avaliação" description="Atribua uma nota inteira de 0 a 10 para cada critério." />
      <form
        className="space-y-6 p-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTentou(true);
          if (valido) setConfirmar(true);
        }}
      >
        {avaliacao.criterios.map((c) => (
          <NotaCriterioInput
            key={c.id}
            criterio={c}
            valor={notas[c.id]}
            erro={tentou && notas[c.id] === undefined}
            onChange={(nota) => setNotas((n) => ({ ...n, [c.id]: nota }))}
          />
        ))}

        <div className="flex items-center justify-between rounded-lg bg-canvas px-4 py-3" aria-live="polite">
          <span className="text-sm font-medium text-ink-muted">Nota final (média)</span>
          <span className={cn('font-display text-2xl font-bold tnum', media !== null && media < notaCorte ? 'text-rose-700' : 'text-ink')}>
            {formatNota(media)}
          </span>
        </div>

        {obrigatorio && (
          <Alert tone="warning" title="Parecer obrigatório (RN07)">
            A média ficou abaixo da nota de corte do edital ({formatNota(notaCorte)}). Justifique a nota para dar transparência à decisão.
          </Alert>
        )}

        <Field
          label="Parecer"
          required={obrigatorio}
          hint={<CharCounter value={parecer} min={obrigatorio ? MIN_PARECER : undefined} max={5000} />}
          error={tentou && !parecerValido(media, notaCorte, parecer) ? `Escreva ao menos ${MIN_PARECER} caracteres.` : undefined}
        >
          <Textarea rows={6} value={parecer} onChange={(e) => setParecer(e.target.value)} maxLength={5000} />
        </Field>

        {tentou && !completa && (
          <p role="alert" className="text-sm font-medium text-rose-700">
            Atribua nota a todos os critérios.
          </p>
        )}

        <Button type="submit" variant="success" className="w-full">
          Enviar parecer
        </Button>
      </form>

      <ConfirmDialog
        open={confirmar}
        title="Enviar o parecer?"
        description={`Nota final ${formatNota(media)}. Depois de enviado, o parecer não pode ser alterado.`}
        confirmLabel="Enviar"
        tone="success"
        loading={emitir.isPending}
        onConfirm={() => void enviar()}
        onCancel={() => setConfirmar(false)}
      />
    </Card>
  );
}

/** Escala segmentada 0–10 (DESIGN.md) como grupo de rádio acessível por teclado. */
function NotaCriterioInput({
  criterio,
  valor,
  erro,
  onChange,
}: {
  criterio: Criterio;
  valor: number | undefined;
  erro: boolean;
  onChange: (nota: number) => void;
}) {
  return (
    <fieldset aria-describedby={`desc-${criterio.id}`}>
      <legend className={cn('text-sm font-semibold text-ink', REQUIRED_MARK)}>{criterio.nome}</legend>
      <p id={`desc-${criterio.id}`} className="mb-2 text-xs text-ink-subtle">
        {criterio.descricao}
      </p>
      <div className={cn('grid grid-cols-11 gap-1', erro && 'rounded-lg ring-2 ring-rose-300 ring-offset-2')}>
        {ESCALA.map((n) => (
          <label key={n} className="relative">
            <input
              type="radio"
              name={criterio.id}
              value={n}
              checked={valor === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span className="flex h-9 cursor-pointer items-center justify-center rounded-md border border-line-strong text-sm font-semibold text-ink-muted transition tnum hover:border-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-[3px] peer-focus-visible:ring-focus">
              {n}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ParecerEnviado({ avaliacao }: { avaliacao: AvaliacaoDetalhe }) {
  const nomeDe = (id: string) => avaliacao.criterios.find((c) => c.id === id)?.nome ?? id;
  return (
    <Card>
      <CardHeader title="Parecer enviado" description={`Em ${formatDateTime(avaliacao.concluidaEm)}`} />
      <div className="space-y-4 p-5">
        <ul className="space-y-2">
          {avaliacao.notas.map((n) => (
            <li key={n.criterio} className="flex justify-between rounded bg-canvas px-3 py-2 text-sm">
              <span className="text-ink-muted">{nomeDe(n.criterio)}</span>
              <span className="font-semibold tnum">{n.nota}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm font-medium text-ink-muted">Nota final</span>
          <span className="font-display text-2xl font-bold tnum">{formatNota(avaliacao.notaFinal)}</span>
        </div>
        {avaliacao.parecer && <p className="whitespace-pre-line text-sm leading-relaxed">{avaliacao.parecer}</p>}
      </div>
    </Card>
  );
}
