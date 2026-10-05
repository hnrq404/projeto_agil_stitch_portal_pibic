import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Plus, Trash2 } from 'lucide-react';

import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { dateInputToIso, isoToDateInput } from '@/shared/lib/format';
import { BOLSA_LABEL } from '@/shared/lib/labels';
import type { BolsaTipo, CnpqArea, Edital } from '@/shared/types/api';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/shared/ui/Form';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { useCnpqAreas, useEdital, useSalvarEdital } from './api';
import { mensagemCotas, resumoCotas } from './cotas';

const BOLSAS = Object.keys(BOLSA_LABEL) as BolsaTipo[];

const numero = (msg: string) => z.number({ invalid_type_error: msg, required_error: msg });

const schema = z
  .object({
    numero: z.string().trim().min(3, 'Informe o número (ex.: 06/2026).'),
    titulo: z.string().trim().min(5, 'O título precisa de ao menos 5 caracteres.'),
    descricao: z.string().trim(),
    tipoBolsa: z.enum(['PIBIC', 'PIBITI', 'PIBIC_AF', 'VOLUNTARIO']),
    totalCotas: numero('Informe o total de bolsas.').int('Use um número inteiro.').min(1, 'Mínimo de 1 bolsa.'),
    notaCorte: numero('Informe a nota de corte.').min(0, 'Entre 0 e 10.').max(10, 'Entre 0 e 10.'),
    dataInicio: z.string().min(1, 'Informe a data de início.'),
    dataFim: z.string().min(1, 'Informe a data de encerramento.'),
    cotas: z
      .array(
        z.object({
          subareaCode: z.string().min(1, 'Selecione a subárea.'),
          quantidade: numero('Informe a quantidade.').int().min(1, 'Mínimo 1.'),
        }),
      )
      .min(1, 'Distribua as bolsas em ao menos uma subárea.'),
  })
  .refine((v) => !v.dataInicio || !v.dataFim || v.dataFim > v.dataInicio, {
    message: 'O encerramento deve ser depois do início.',
    path: ['dataFim'],
  });

type FormValues = z.infer<typeof schema>;

const VAZIO: FormValues = {
  numero: '',
  titulo: '',
  descricao: '',
  tipoBolsa: 'PIBIC',
  totalCotas: 5,
  notaCorte: 6,
  dataInicio: '',
  dataFim: '',
  cotas: [{ subareaCode: '1.03', quantidade: 1 }],
};

function toForm(edital: Edital): FormValues {
  return {
    numero: edital.numero,
    titulo: edital.titulo,
    descricao: edital.descricao,
    tipoBolsa: edital.tipoBolsa,
    totalCotas: edital.totalCotas,
    notaCorte: edital.notaCorte,
    dataInicio: isoToDateInput(edital.dataInicioInscricoes),
    dataFim: isoToDateInput(edital.dataFimInscricoes),
    cotas: edital.cotas.map((c) => ({ subareaCode: c.subareaCode, quantidade: c.quantidade })),
  };
}

/** Criar/editar edital (S2.1/S2.2) com validação em tempo real da soma de cotas. */
export function EditalFormPage() {
  const { id } = useParams<{ id: string }>();
  const edital = useEdital(id);
  // Os selects de subárea só montam com as opções prontas; senão o valor inicial não aparece.
  const areas = useCnpqAreas();

  if ((id && edital.isPending) || areas.isPending) return <LoadingState label="Carregando formulário..." />;
  if (id && edital.isError) return <ErrorState error={edital.error} onRetry={() => void edital.refetch()} />;
  if (areas.isError) return <ErrorState error={areas.error} onRetry={() => void areas.refetch()} />;
  if (edital.data && edital.data.status !== 'RASCUNHO') {
    return (
      <EmptyState
        icon={<Lock className="h-6 w-6" />}
        title="Este edital não pode mais ser editado"
        description="Somente editais em rascunho são editáveis. Depois de publicado, o edital vale como documento oficial."
        action={<ButtonLink to={`/gestor/editais/${edital.data.id}`}>Ver edital</ButtonLink>}
      />
    );
  }

  return <EditalForm key={id ?? 'novo'} edital={edital.data} areas={areas.data} />;
}

function EditalForm({ edital, areas }: { edital?: Edital; areas: CnpqArea[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const salvar = useSalvarEdital();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: edital ? toForm(edital) : VAZIO });
  const { fields, append, remove } = useFieldArray({ control, name: 'cotas' });

  useEffect(() => {
    if (edital) reset(toForm(edital));
  }, [edital, reset]);

  const totalCotas = useWatch({ control, name: 'totalCotas' });
  const cotas = useWatch({ control, name: 'cotas' });
  const resumo = resumoCotas(Number(totalCotas), cotas ?? []);
  const bloqueado = resumo.excede || resumo.duplicadas.length > 0;

  const submit = (publicar: boolean) =>
    handleSubmit(async (values) => {
      setErro(null);
      try {
        const salvo = await salvar.mutateAsync({
          id: edital?.id,
          publicar,
          input: {
            numero: values.numero,
            titulo: values.titulo,
            descricao: values.descricao,
            tipoBolsa: values.tipoBolsa,
            totalCotas: values.totalCotas,
            notaCorte: values.notaCorte,
            cotas: values.cotas,
            dataInicioInscricoes: dateInputToIso(values.dataInicio, false),
            dataFimInscricoes: dateInputToIso(values.dataFim, true),
          },
        });
        toast.success(publicar ? `Edital ${salvo.numero} publicado.` : `Rascunho do edital ${salvo.numero} salvo.`);
        navigate(publicar ? '/gestor/editais' : `/gestor/editais/${salvo.id}`);
      } catch (error) {
        setErro(errorMessage(error));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

  return (
    <>
      <PageHeader
        title={edital ? `Editar edital ${edital.numero}` : 'Novo edital'}
        description="Defina prazos, nota de corte e como as bolsas se distribuem entre as subáreas CNPq."
        back={{ to: edital ? `/gestor/editais/${edital.id}` : '/gestor/editais', label: 'Voltar' }}
      />

      {erro && (
        <Alert tone="danger" title="Não foi possível salvar" className="mb-4">
          {erro}
        </Alert>
      )}

      <form onSubmit={submit(false)} noValidate className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Identificação" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Número do edital" hint="Ex.: 06/2026" error={errors.numero?.message} required>
                <Input {...register('numero')} />
              </Field>
              <Field label="Tipo de bolsa" error={errors.tipoBolsa?.message} required>
                <Select {...register('tipoBolsa')}>
                  {BOLSAS.map((b) => (
                    <option key={b} value={b}>
                      {BOLSA_LABEL[b]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Título" error={errors.titulo?.message} required className="sm:col-span-2">
                <Input {...register('titulo')} />
              </Field>
              <Field label="Descrição" className="sm:col-span-2" hint="Aparece na vitrine pública de editais.">
                <Textarea rows={3} {...register('descricao')} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Cotas por subárea CNPq"
              description="A soma das cotas não pode ultrapassar o total de bolsas do edital."
            />
            <div className="space-y-3 p-5">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[1fr_9.5rem_auto] items-end gap-2">
                  <Field label="Subárea CNPq" error={errors.cotas?.[index]?.subareaCode?.message}>
                    <Select {...register(`cotas.${index}.subareaCode`)}>
                      <option value="">Selecione...</option>
                      {areas.map((area) => (
                        <option key={area.code} value={area.code}>
                          {area.code}: {area.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Quantidade de bolsas" error={errors.cotas?.[index]?.quantidade?.message}>
                    <Input type="number" min={1} inputMode="numeric" {...register(`cotas.${index}.quantidade`, { valueAsNumber: true })} />
                  </Field>
                  <Button
                    variant="ghost"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={`Remover cota ${index + 1}`}
                    icon={<Trash2 className="h-4 w-4" aria-hidden />}
                  />
                </div>
              ))}
              {errors.cotas?.root?.message && <p className="text-sm text-danger-700">{errors.cotas.root.message}</p>}

              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => append({ subareaCode: '', quantidade: 1 })}
              >
                Adicionar cota por subárea
              </Button>

              <div
                data-testid="soma-cotas"
                aria-live="polite"
                className={cn(
                  'rounded-lg px-3 py-2 text-sm',
                  resumo.excede && 'bg-danger-50 font-medium text-danger-800',
                  !resumo.excede && resumo.completa && 'bg-success-50 text-success-800',
                  !resumo.excede && !resumo.completa && 'bg-canvas text-ink-muted',
                )}
              >
                {mensagemCotas(Number(totalCotas) || 0, resumo)}
              </div>
              {resumo.duplicadas.length > 0 && (
                <p className="text-sm font-medium text-danger-700">
                  Subárea repetida ({resumo.duplicadas.join(', ')}): cada subárea pode aparecer uma única vez.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Bolsas e prazos" />
            <div className="space-y-4 p-5">
              <Field label="Total de bolsas" error={errors.totalCotas?.message} required>
                <Input type="number" min={1} inputMode="numeric" {...register('totalCotas', { valueAsNumber: true })} />
              </Field>
              <Field
                label="Nota de corte"
                hint="De 0 a 10. Abaixo dela, o parecer do avaliador é obrigatório (RN07)."
                error={errors.notaCorte?.message}
                required
              >
                <Input type="number" min={0} max={10} step={0.5} {...register('notaCorte', { valueAsNumber: true })} />
              </Field>
              <Field label="Início das inscrições" error={errors.dataInicio?.message} required>
                <Input type="date" {...register('dataInicio')} />
              </Field>
              <Field label="Fim das inscrições" error={errors.dataFim?.message} required>
                <Input type="date" {...register('dataFim')} />
              </Field>
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" variant="secondary" disabled={bloqueado} loading={salvar.isPending && !salvar.variables?.publicar}>
              Salvar rascunho
            </Button>
            <Button
              variant="success"
              disabled={bloqueado}
              loading={salvar.isPending && salvar.variables?.publicar}
              onClick={() => void submit(true)()}
            >
              Salvar e publicar
            </Button>
            <p className="text-xs text-ink-subtle">
              Publicar abre as inscrições e notifica todos os usuários. Depois disso o edital não pode ser editado.
            </p>
          </div>
        </div>
      </form>
    </>
  );
}
