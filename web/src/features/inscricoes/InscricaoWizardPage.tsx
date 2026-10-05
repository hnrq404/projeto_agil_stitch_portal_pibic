import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, CircleAlert, CloudOff, Loader2 } from 'lucide-react';

import { useEditalPublico } from '@/features/editais/api';
import { ApiError, errorMessage } from '@/shared/api/http';
import { useAutoSave, type AutoSaveStatus } from '@/shared/hooks/useAutoSave';
import { formatDate, formatTime } from '@/shared/lib/format';
import { ANEXO_LABEL } from '@/shared/lib/labels';
import type { AnexoTipo, Inscricao } from '@/shared/types/api';
import { Code } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmDialog } from '@/shared/ui/Dialog';
import { Alert, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { CharCounter, Field, Input, Select, Textarea } from '@/shared/ui/Form';
import { FileDropzone } from '@/shared/ui/FileDropzone';
import { PageHeader } from '@/shared/ui/PageHeader';
import { abrirPdf } from '@/shared/ui/PdfViewer';
import { Stepper } from '@/shared/ui/Stepper';
import { useToast } from '@/shared/ui/Toast';

import {
  anexoUrl,
  useDocentes,
  useEnviarAnexo,
  useInscricao,
  useRemoverAnexo,
  useSalvarRascunho,
  useSubmeterInscricao,
} from './api';
import { CAMPOS_DA_ETAPA, ETAPAS, MIN_RESUMO, MIN_TEXTO, rascunhoSchema, type RascunhoForm } from './etapas';

function toForm(i: Inscricao): RascunhoForm {
  return {
    titulo: i.titulo,
    subareaCode: i.subareaCode,
    palavrasChave: i.palavrasChave,
    resumo: i.resumo,
    objetivos: i.objetivos,
    metodologia: i.metodologia,
    orientadorId: i.orientador?.id ?? '',
  };
}

/** Formulário multi-etapas (S3.1) com auto-save do rascunho (S3.5). */
export function InscricaoWizardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: inscricao, isPending, isError, error, refetch } = useInscricao(id);

  if (isPending) return <LoadingState label="Carregando inscrição..." />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;
  // RN05: submetida não volta ao formulário.
  if (inscricao.status !== 'RASCUNHO') return <Navigate to={`/inscricoes/${inscricao.id}`} replace />;

  return <Wizard inscricao={inscricao} />;
}

function Wizard({ inscricao }: { inscricao: Inscricao }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [etapa, setEtapa] = useState(0);
  const [maxEtapa, setMaxEtapa] = useState(0);
  const [confirmar, setConfirmar] = useState(false);
  const [erroSubmissao, setErroSubmissao] = useState<{ mensagem: string; pendencias: string[] } | null>(null);

  const salvar = useSalvarRascunho(inscricao.id);
  const submeter = useSubmeterInscricao(inscricao.id);
  const autoSave = useAutoSave<RascunhoForm>({
    save: (v) => salvar.mutateAsync({ ...v, orientadorId: v.orientadorId || null }),
  });

  const form = useForm<RascunhoForm>({
    resolver: zodResolver(rascunhoSchema),
    defaultValues: toForm(inscricao),
    mode: 'onTouched',
  });

  // Cada alteração agenda um auto-save.
  const { schedule } = autoSave;
  useEffect(() => {
    const sub = form.watch((values) => schedule(values as RascunhoForm));
    return () => sub.unsubscribe();
  }, [form, schedule]);

  async function avancar() {
    const ok = await form.trigger(CAMPOS_DA_ETAPA[etapa], { shouldFocus: true });
    if (!ok) return;
    const proxima = Math.min(etapa + 1, ETAPAS.length - 1);
    setEtapa(proxima);
    setMaxEtapa((m) => Math.max(m, proxima));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enviar() {
    setErroSubmissao(null);
    try {
      await autoSave.flush();
      await submeter.mutateAsync();
      toast.success('Inscrição submetida. Seu orientador foi avisado para confirmar o vínculo.');
      navigate(`/inscricoes/${inscricao.id}`);
    } catch (error) {
      setConfirmar(false);
      setErroSubmissao({
        mensagem: errorMessage(error),
        pendencias: error instanceof ApiError ? error.pendencias : [],
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={inscricao.edital && <Code>{`Edital ${inscricao.edital.numero}`}</Code>}
        title="Inscrição de pesquisa"
        description={
          inscricao.edital &&
          `${inscricao.edital.titulo}. Inscrições até ${formatDate(inscricao.edital.dataFimInscricoes)}.`
        }
        back={{ to: '/inscricoes', label: 'Minhas inscrições' }}
        actions={<IndicadorSalvamento status={autoSave.status} savedAt={autoSave.savedAt} />}
      />

      {inscricao.vinculoStatus === 'RECUSADO' && (
        <Alert tone="warning" title="O orientador indicado recusou o vínculo" className="mb-4">
          <p>Motivo: {inscricao.vinculoComentario}</p>
          <p>Indique outro orientador na etapa 3 e submeta novamente.</p>
        </Alert>
      )}

      <Card className="mb-6 px-5 py-4">
        <Stepper steps={ETAPAS} current={etapa} maxReached={maxEtapa} onSelect={setEtapa} />
      </Card>

      <Card className="p-5 sm:p-6">
        <form onSubmit={(e) => e.preventDefault()} noValidate>
          {etapa === 0 && <EtapaProjeto form={form} editalId={inscricao.edital?.id} />}
          {etapa === 1 && <EtapaProposta form={form} />}
          {etapa === 2 && <EtapaOrientador form={form} />}
          {etapa === 3 && <EtapaDocumentos inscricao={inscricao} />}
          {etapa === 4 && <EtapaRevisao inscricao={inscricao} form={form} erro={erroSubmissao} irPara={setEtapa} />}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <Button variant="secondary" onClick={() => setEtapa((e) => Math.max(0, e - 1))} disabled={etapa === 0}>
              Voltar
            </Button>
            {etapa < ETAPAS.length - 1 ? (
              <Button onClick={() => void avancar()}>Próximo</Button>
            ) : (
              <Button
                variant="success"
                onClick={() => setConfirmar(true)}
                disabled={(inscricao.pendencias?.length ?? 0) > 0}
              >
                Submeter inscrição
              </Button>
            )}
          </div>
        </form>
      </Card>

      <ConfirmDialog
        open={confirmar}
        title="Submeter a inscrição?"
        description="Depois de submetida, a proposta não pode mais ser editada (RN05). Seu orientador receberá um pedido para confirmar o vínculo."
        confirmLabel="Submeter"
        tone="success"
        loading={submeter.isPending}
        onConfirm={() => void enviar()}
        onCancel={() => setConfirmar(false)}
      />
    </>
  );
}

function IndicadorSalvamento({ status, savedAt }: { status: AutoSaveStatus; savedAt: Date | null }) {
  const conteudo: Record<AutoSaveStatus, { icon: ReactNode; texto: string }> = {
    idle: { icon: <CheckCircle2 className="h-4 w-4 text-ink-subtle" />, texto: 'Rascunho salvo automaticamente' },
    pending: { icon: <Loader2 className="h-4 w-4 text-ink-subtle" />, texto: 'Alterações não salvas' },
    saving: { icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />, texto: 'Salvando...' },
    saved: {
      icon: <CheckCircle2 className="h-4 w-4 text-success-600" />,
      texto: savedAt ? `Salvo às ${formatTime(savedAt)}` : 'Salvo',
    },
    error: { icon: <CloudOff className="h-4 w-4 text-danger-600" />, texto: 'Falha ao salvar. Tentaremos de novo na próxima alteração.' },
  };
  const { icon, texto } = conteudo[status];
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
      <span aria-hidden>{icon}</span>
      {texto}
    </p>
  );
}

type FormProps = { form: UseFormReturn<RascunhoForm> };

function EtapaProjeto({ form, editalId }: FormProps & { editalId?: string }) {
  const edital = useEditalPublico(editalId);
  const { register, formState } = form;
  return (
    <fieldset className="space-y-5">
      <legend className="text-lg font-semibold">Dados do projeto</legend>
      <Field label="Título do projeto" error={formState.errors.titulo?.message} required>
        <Input {...register('titulo')} />
      </Field>
      <Field
        label="Subárea CNPq"
        hint="Somente subáreas com bolsas neste edital."
        error={formState.errors.subareaCode?.message}
        required
      >
        {edital.data ? (
          <Select {...register('subareaCode')}>
            <option value="">Selecione...</option>
            {edital.data.cotas.map((c) => (
              <option key={c.subareaCode} value={c.subareaCode}>
                {c.subareaCode}: {c.subareaNome} ({c.quantidade} bolsas)
              </option>
            ))}
          </Select>
        ) : (
          <SelectCarregando erro={edital.isError} />
        )}
      </Field>
      <Field label="Palavras-chave" hint="Separe por ponto e vírgula." error={formState.errors.palavrasChave?.message}>
        <Input placeholder="aprendizado de máquina; saúde" {...register('palavrasChave')} />
      </Field>
    </fieldset>
  );
}

/** Placeholder enquanto as opções carregam: o select real só monta com elas (valor inicial visível). */
function SelectCarregando({ erro, ...rest }: { erro: boolean }) {
  return (
    <Select disabled {...rest}>
      <option>{erro ? 'Não foi possível carregar as opções. Recarregue a página.' : 'Carregando opções...'}</option>
    </Select>
  );
}

function EtapaProposta({ form }: FormProps) {
  const { register, formState, watch } = form;
  const [resumo, objetivos, metodologia] = watch(['resumo', 'objetivos', 'metodologia']);
  return (
    <fieldset className="space-y-5">
      <legend className="text-lg font-semibold">Proposta</legend>
      <Field
        label="Resumo"
        hint={<CharCounter value={resumo} min={MIN_RESUMO} max={3000} />}
        error={formState.errors.resumo?.message}
        required
      >
        <Textarea rows={6} {...register('resumo')} />
      </Field>
      <Field
        label="Objetivos"
        hint={<CharCounter value={objetivos} min={MIN_TEXTO} max={3000} />}
        error={formState.errors.objetivos?.message}
        required
      >
        <Textarea rows={4} {...register('objetivos')} />
      </Field>
      <Field
        label="Metodologia"
        hint={<CharCounter value={metodologia} min={MIN_TEXTO} max={5000} />}
        error={formState.errors.metodologia?.message}
        required
      >
        <Textarea rows={5} {...register('metodologia')} />
      </Field>
    </fieldset>
  );
}

function EtapaOrientador({ form }: FormProps) {
  const docentes = useDocentes();
  const { register, formState } = form;
  return (
    <fieldset className="space-y-5">
      <legend className="text-lg font-semibold">Orientador</legend>
      <p className="text-sm text-ink-muted">
        Após a submissão, o docente indicado recebe um pedido para confirmar a orientação. A proposta só segue para a
        avaliação depois dessa confirmação.
      </p>
      <Field label="Orientador(a)" error={formState.errors.orientadorId?.message} required>
        {docentes.data ? (
          <Select {...register('orientadorId')}>
            <option value="">Selecione...</option>
            {docentes.data.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
                {d.departamento ? ` (${d.departamento})` : ''}
              </option>
            ))}
          </Select>
        ) : (
          <SelectCarregando erro={docentes.isError} />
        )}
      </Field>
    </fieldset>
  );
}

function EtapaDocumentos({ inscricao }: { inscricao: Inscricao }) {
  const enviar = useEnviarAnexo(inscricao.id);
  const remover = useRemoverAnexo(inscricao.id);
  const toast = useToast();

  const doTipo = (tipo: AnexoTipo) => inscricao.anexos.find((a) => a.tipo === tipo) ?? null;

  return (
    <fieldset className="space-y-6">
      <legend className="text-lg font-semibold">Documentos</legend>
      {(['PLANO_TRABALHO', 'LATTES'] as const).map((tipo) => {
        const atual = doTipo(tipo);
        return (
          <FileDropzone
            key={tipo}
            label={ANEXO_LABEL[tipo]}
            required
            description={
              tipo === 'PLANO_TRABALHO'
                ? 'Cronograma de atividades do bolsista para 12 meses.'
                : 'Exporte o currículo na Plataforma Lattes em PDF.'
            }
            current={atual}
            onUpload={(file, onProgress) => enviar.mutateAsync({ tipo, file, onProgress })}
            onOpen={atual ? () => void abrirPdf(anexoUrl(inscricao.id, atual.id)).catch((e) => toast.error(errorMessage(e))) : undefined}
            onRemove={atual ? () => remover.mutate(atual.id, { onError: (e) => toast.error(errorMessage(e)) }) : undefined}
          />
        );
      })}
    </fieldset>
  );
}

function EtapaRevisao({
  inscricao,
  form,
  erro,
  irPara,
}: FormProps & {
  inscricao: Inscricao;
  erro: { mensagem: string; pendencias: string[] } | null;
  irPara: (etapa: number) => void;
}) {
  const valores = form.getValues();
  const docentes = useDocentes();
  const orientador = docentes.data?.find((d) => d.id === valores.orientadorId);
  const pendencias = inscricao.pendencias ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Revisão</h2>

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

      {pendencias.length > 0 ? (
        <Alert tone="warning" title="Ainda falta completar">
          <ul className="space-y-1">
            {pendencias.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert tone="success" title="Tudo pronto para submeter">
          Confira os dados abaixo. Depois de submetida, a inscrição não pode ser alterada.
        </Alert>
      )}

      <dl className="divide-y divide-line rounded-lg border border-line">
        <Resumo label="Título" etapa={0} irPara={irPara}>{valores.titulo || '-'}</Resumo>
        <Resumo label="Subárea" etapa={0} irPara={irPara}>{inscricao.subareaNome || '-'}</Resumo>
        <Resumo label="Resumo" etapa={1} irPara={irPara}>
          <span className="line-clamp-3">{valores.resumo || '-'}</span>
        </Resumo>
        <Resumo label="Orientador" etapa={2} irPara={irPara}>{orientador?.nome ?? '-'}</Resumo>
        <Resumo label="Documentos" etapa={3} irPara={irPara}>
          {inscricao.anexos.length === 0 ? '-' : inscricao.anexos.map((a) => a.nome).join(', ')}
        </Resumo>
      </dl>
    </div>
  );
}

function Resumo({
  label,
  etapa,
  irPara,
  children,
}: {
  label: string;
  etapa: number;
  irPara: (etapa: number) => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:gap-4">
      <dt className="text-sm font-medium text-ink-subtle">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
      <dd>
        <button type="button" onClick={() => irPara(etapa)} className="text-sm font-semibold text-primary hover:underline">
          Editar<span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      </dd>
    </div>
  );
}
