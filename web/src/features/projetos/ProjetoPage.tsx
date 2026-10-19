import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, Check, FileText, Paperclip, Undo2 } from 'lucide-react';

import { useCurrentUser } from '@/features/auth/AuthProvider';
import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { diasAte, formatBytes, formatDate, formatDateTime } from '@/shared/lib/format';
import { RELATORIO_STATUS, SITUACAO_RELATORIO } from '@/shared/lib/labels';
import type { AcompanhamentoRelatorio, ProjetoDetalhe, Relatorio, RelatorioTipo } from '@/shared/types/api';
import { Code, StatusBadge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader, DataItem } from '@/shared/ui/Card';
import { Dialog } from '@/shared/ui/Dialog';
import { Alert, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { validarPdf } from '@/shared/ui/FileDropzone';
import { CharCounter, Field, Select, Textarea } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { abrirPdf } from '@/shared/ui/PdfViewer';
import { useToast } from '@/shared/ui/Toast';

import { relatorioUrl, useAnexarPdfRelatorio, useAvaliarRelatorio, useEnviarRelatorio, useProjeto } from './api';

/** Espelha MIN_DESCRICAO do backend (projetos.rules). */
const MIN_DESCRICAO = 50;

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** "2026-09" → "setembro/2026". */
function nomeMes(competencia: string | null): string {
  if (!competencia) return '';
  const [ano, mes] = competencia.split('-').map(Number);
  return `${MESES[(mes ?? 1) - 1]}/${ano}`;
}

function rotulo(tipo: RelatorioTipo, competencia: string | null): string {
  return tipo === 'MENSAL' ? `Relatório de ${nomeMes(competencia)}` : 'Relatório final';
}

/** O bolsista pode (re)enviar enquanto não há versão em análise nem aprovada. */
const ENVIAVEL = ['AGUARDANDO_ENVIO', 'ATRASADO', 'DEVOLVIDO'];

/** O formulário do relatório final só aparece perto do fim da vigência. */
const DIAS_ANTES_DO_FINAL = 60;

/** RF19–RF21: bolsa aprovada, relatórios mensais (dia 5) e final, versões e histórico. */
export function ProjetoPage() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const { data, isPending, isError, error, refetch } = useProjeto(id);

  if (isPending) return <LoadingState label="Carregando projeto..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { projeto } = data;
  const souBolsista = projeto.discente?.id === user.id;
  const mensais = data.acompanhamento.filter((a) => a.tipo === 'MENSAL');
  const final = data.acompanhamento.find((a) => a.tipo === 'FINAL');
  const atrasados = mensais.filter((a) => a.situacao === 'ATRASADO');

  return (
    <>
      <PageHeader
        eyebrow={<Code>{projeto.protocolo ?? '-'}</Code>}
        title={projeto.titulo}
        back={{ to: '/projetos', label: 'Bolsas e relatórios' }}
      />
      {atrasados.length > 0 && (
        <Alert tone="danger" title={`${atrasados.length} relatório(s) mensal(is) em atraso`} className="mb-6">
          {atrasados.map((a) => nomeMes(a.competencia)).join(', ')}. O relatório de cada mês vence no dia 5 do mês seguinte.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {souBolsista && <EnviarRelatorioMensal detalhe={data} mensais={mensais} />}
          <CalendarioRelatorios mensais={mensais} final={final} />
          {final && <RelatorioFinal detalhe={data} final={final} souBolsista={souBolsista} />}
          <HistoricoRelatorios detalhe={data} souBolsista={souBolsista} />
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

/** Seletor de PDF opcional/obrigatório, validado no cliente (RN06). */
function ArquivoPdf({
  arquivo,
  onChange,
  obrigatorio,
}: {
  arquivo: File | null;
  onChange: (file: File | null, erro: string | null) => void;
  obrigatorio?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label={obrigatorio ? 'PDF do relatório (obrigatório)' : 'PDF do relatório (opcional)'}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          onChange(file, file ? validarPdf(file) : null);
          e.target.value = '';
        }}
      />
      <Button variant="secondary" size="sm" icon={<Paperclip className="h-4 w-4" aria-hidden />} onClick={() => input.current?.click()}>
        {arquivo ? 'Trocar PDF' : obrigatorio ? 'Anexar PDF' : 'Anexar PDF (opcional)'}
      </Button>
      {arquivo && (
        <span className="text-ink-muted">
          {arquivo.name}, {formatBytes(arquivo.size)}{' '}
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onChange(null, null)}>
            remover
          </button>
        </span>
      )}
    </div>
  );
}

/** Bolsista: conta o que fez no mês. O mês mais urgente vem selecionado. */
function EnviarRelatorioMensal({ detalhe, mensais }: { detalhe: ProjetoDetalhe; mensais: AcompanhamentoRelatorio[] }) {
  const toast = useToast();
  const enviar = useEnviarRelatorio(detalhe.projeto.id);
  const pendentes = mensais.filter((a) => ENVIAVEL.includes(a.situacao) && a.competencia);
  // Atrasados e devolvidos primeiro, depois o mais antigo aguardando.
  const ordem = (a: AcompanhamentoRelatorio) => (a.situacao === 'ATRASADO' ? 0 : a.situacao === 'DEVOLVIDO' ? 1 : 2);
  const sugerido = [...pendentes].sort((a, b) => ordem(a) - ordem(b))[0]?.competencia ?? '';
  const [competencia, setCompetencia] = useState(sugerido);
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const mesEscolhido = competencia || sugerido;

  if (pendentes.length === 0) {
    return (
      <Alert tone="success" title="Relatórios mensais em dia">
        O próximo relatório vence no dia 5 do mês que vem, contando o que você fez neste mês.
      </Alert>
    );
  }

  async function submeter() {
    setErro(null);
    try {
      await enviar.mutateAsync({
        tipo: 'MENSAL',
        competencia: mesEscolhido,
        descricao,
        arquivo,
        onProgress: setProgresso,
      });
      toast.success('Relatório enviado. Seu orientador foi avisado.');
      setDescricao('');
      setArquivo(null);
      setCompetencia('');
    } catch (e) {
      setErro(errorMessage(e));
    } finally {
      setProgresso(null);
    }
  }

  const item = pendentes.find((p) => p.competencia === mesEscolhido);
  return (
    <Card>
      <CardHeader
        title="Relatório mensal"
        description="Todo dia 5, conte o que você fez no mês anterior. O PDF é opcional (resultados, figuras, tabelas)."
      />
      <div className="space-y-4 p-5">
        {erro && <Alert tone="danger">{erro}</Alert>}
        <Field label="Mês de referência" required>
          <Select value={mesEscolhido} onChange={(e) => setCompetencia(e.target.value)}>
            {pendentes.map((p) => (
              <option key={p.competencia} value={p.competencia ?? ''}>
                {nomeMes(p.competencia)} ({SITUACAO_RELATORIO[p.situacao].label.toLowerCase()}, prazo {formatDate(p.prazo)})
              </option>
            ))}
          </Select>
        </Field>
        {item?.situacao === 'DEVOLVIDO' && (
          <Alert tone="warning">O orientador devolveu este mês para correção. Veja o comentário no histórico abaixo.</Alert>
        )}
        <Field
          label={`O que você fez em ${nomeMes(mesEscolhido)}`}
          hint={<CharCounter value={descricao} min={MIN_DESCRICAO} max={10000} />}
          required
        >
          <Textarea
            rows={6}
            maxLength={10000}
            placeholder="Atividades realizadas, resultados obtidos, dificuldades e o que planeja para o próximo mês."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Field>
        <ArquivoPdf
          arquivo={arquivo}
          onChange={(file, erroArquivo) => {
            setErro(erroArquivo);
            setArquivo(erroArquivo ? null : file);
          }}
        />
        <div className="flex items-center justify-end gap-3">
          {progresso !== null && <span className="text-sm text-ink-muted tnum">Enviando PDF: {progresso}%</span>}
          <Button disabled={descricao.trim().length < MIN_DESCRICAO} loading={enviar.isPending} onClick={() => void submeter()}>
            Enviar relatório
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CalendarioRelatorios({ mensais, final }: { mensais: AcompanhamentoRelatorio[]; final?: AcompanhamentoRelatorio }) {
  const itens = [...mensais].reverse();
  return (
    <Card>
      <CardHeader title="Calendário de relatórios" description="Um relatório por mês da bolsa, até o dia 5 do mês seguinte." />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-canvas text-left text-xs uppercase tracking-wider text-ink-subtle">
            <tr>
              <th scope="col" className="px-5 py-2 font-semibold">Relatório</th>
              <th scope="col" className="px-5 py-2 font-semibold">Prazo</th>
              <th scope="col" className="px-5 py-2 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {[...(final ? [final] : []), ...itens].map((a) => {
              const dias = diasAte(a.prazo);
              const aberto = a.situacao === 'AGUARDANDO_ENVIO';
              return (
                <tr key={`${a.tipo}-${a.competencia ?? ''}`}>
                  <td className="px-5 py-3 font-medium text-ink">{rotulo(a.tipo, a.competencia)}</td>
                  <td className="px-5 py-3 text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                      {formatDate(a.prazo)}
                      {aberto && dias >= 0 && <span className={cn('text-xs', dias <= 5 && 'font-semibold text-warning-800')}>(faltam {dias} dias)</span>}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={SITUACAO_RELATORIO[a.situacao]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Relatório final: texto opcional e PDF obrigatório. */
function RelatorioFinal({
  detalhe,
  final,
  souBolsista,
}: {
  detalhe: ProjetoDetalhe;
  final: AcompanhamentoRelatorio;
  souBolsista: boolean;
}) {
  const toast = useToast();
  const enviar = useEnviarRelatorio(detalhe.projeto.id);
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const perto = diasAte(final.prazo) <= DIAS_ANTES_DO_FINAL || final.situacao !== 'AGUARDANDO_ENVIO';
  if (!souBolsista || !ENVIAVEL.includes(final.situacao) || !perto) return null;

  async function submeter() {
    setErro(null);
    try {
      await enviar.mutateAsync({ tipo: 'FINAL', descricao, arquivo });
      toast.success('Relatório final enviado. Seu orientador foi avisado.');
      setDescricao('');
      setArquivo(null);
    } catch (e) {
      setErro(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader title="Relatório final" description={`Prazo: ${formatDate(final.prazo)}. Envie o PDF do relatório final da bolsa.`} />
      <div className="space-y-4 p-5">
        {erro && <Alert tone="danger">{erro}</Alert>}
        <Field label="Comentário para o orientador" hint="Opcional.">
          <Textarea rows={3} maxLength={10000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Field>
        <ArquivoPdf
          obrigatorio
          arquivo={arquivo}
          onChange={(file, erroArquivo) => {
            setErro(erroArquivo);
            setArquivo(erroArquivo ? null : file);
          }}
        />
        <div className="flex justify-end">
          <Button disabled={!arquivo} loading={enviar.isPending} onClick={() => void submeter()}>
            Enviar relatório final
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HistoricoRelatorios({ detalhe, souBolsista }: { detalhe: ProjetoDetalhe; souBolsista: boolean }) {
  const user = useCurrentUser();
  const toast = useToast();
  const anexar = useAnexarPdfRelatorio(detalhe.projeto.id);
  const souOrientador = detalhe.projeto.orientador?.id === user.id;
  const [avaliando, setAvaliando] = useState<{ relatorio: Relatorio; decisao: 'APROVAR' | 'DEVOLVER' } | null>(null);
  const [anexandoEm, setAnexandoEm] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (detalhe.relatorios.length === 0) {
    return <Card className="p-5 text-sm text-ink-muted">Nenhum relatório enviado ainda.</Card>;
  }

  async function anexarPdf(file: File) {
    const relatorioId = anexandoEm;
    if (!relatorioId) return;
    const erro = validarPdf(file);
    if (erro) {
      toast.error(erro);
      return;
    }
    try {
      await anexar.mutateAsync({ relatorioId, file, onProgress: () => undefined });
      toast.success('PDF anexado ao relatório.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAnexandoEm(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Relatórios enviados" description="Todas as versões ficam registradas." />
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void anexarPdf(file);
        }}
      />
      <ul className="divide-y divide-line">
        {[...detalhe.relatorios].reverse().map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">
                {rotulo(r.tipo, r.competencia)}, versão {r.versao}
              </p>
              <p className="text-xs text-ink-subtle">
                Enviado em {formatDateTime(r.enviadoEm)}
                {r.arquivo ? `, PDF ${r.arquivo.nome} (${formatBytes(r.arquivo.tamanho)})` : ', sem PDF'}
              </p>
              {r.descricao && <p className="mt-2 whitespace-pre-line text-sm text-ink">{r.descricao}</p>}
              {r.comentarioOrientador && (
                <p className="mt-2 rounded bg-canvas px-3 py-2 text-sm text-ink">
                  <span className="font-medium">Orientador:</span> {r.comentarioOrientador}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={RELATORIO_STATUS[r.status]} />
              {r.arquivo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void abrirPdf(relatorioUrl(detalhe.projeto.id, r.id)).catch((e) => toast.error(errorMessage(e)))}
                >
                  Abrir PDF
                </Button>
              )}
              {souBolsista && r.status === 'ENVIADO' && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Paperclip className="h-4 w-4" aria-hidden />}
                  loading={anexar.isPending && anexandoEm === r.id}
                  onClick={() => {
                    setAnexandoEm(r.id);
                    input.current?.click();
                  }}
                >
                  {r.arquivo ? 'Trocar PDF' : 'Anexar PDF'}
                </Button>
              )}
              {souOrientador && r.status === 'ENVIADO' && (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    icon={<Check className="h-4 w-4" aria-hidden />}
                    disabled={r.tipo === 'FINAL' && !r.arquivo}
                    title={r.tipo === 'FINAL' && !r.arquivo ? 'O relatório final precisa do PDF para ser aprovado.' : undefined}
                    onClick={() => setAvaliando({ relatorio: r, decisao: 'APROVAR' })}
                  >
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
      description={`${rotulo(relatorio.tipo, relatorio.competencia)}, versão ${relatorio.versao}.`}
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
