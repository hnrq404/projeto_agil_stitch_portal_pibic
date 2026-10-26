import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';

import { enviarAoArmazenamento, errorMessage, http } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Feedback';
import { validarPdf } from '@/shared/ui/FileDropzone';
import { Field, Input } from '@/shared/ui/Form';

import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';
import { ReenviarLink } from './ReenviarLink';

/** Mesma regra da API (server/src/modules/auth/dto/auth.dto.ts). */
const DOMINIO_INSTITUCIONAL = '@unicap.br';

const PERFIS = [
  { value: 'DISCENTE', label: 'Discente', descricao: 'Vou me candidatar aos projetos de pesquisa dos professores.' },
  { value: 'DOCENTE', label: 'Docente', descricao: 'Vou divulgar projetos, orientar alunos e avaliar projetos de colegas.' },
  { value: 'USUARIO', label: 'Visitante', descricao: 'Quero acompanhar editais e pesquisas publicadas.' },
] as const;

const schema = z
  .object({
    nome: z.string().trim().min(3, 'Informe o nome completo.'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Informe o e-mail.')
      .email('E-mail inválido.')
      .refine((e) => e.endsWith(DOMINIO_INSTITUCIONAL), `Use seu e-mail institucional ${DOMINIO_INSTITUCIONAL}.`),
    // Mesma política da API (server/src/modules/auth/dto/auth.dto.ts).
    senha: z
      .string()
      .min(8, 'A senha precisa de ao menos 8 caracteres.')
      .max(72, 'A senha pode ter no máximo 72 caracteres.')
      .refine((s) => /\p{L}/u.test(s) && /\d/.test(s), 'Combine letras e números.'),
    confirmacao: z.string(),
    role: z.enum(['DISCENTE', 'DOCENTE', 'USUARIO']),
    departamento: z.string().trim().max(60).optional(),
    matricula: z.string().trim().max(30).optional(),
  })
  .refine((v) => v.senha === v.confirmacao, { message: 'As senhas não conferem.', path: ['confirmacao'] })
  .refine((v) => v.role !== 'DOCENTE' || Boolean(v.departamento), {
    message: 'Informe o departamento (usado para evitar conflito de interesse na avaliação).',
    path: ['departamento'],
  })
  .refine((v) => v.role !== 'DISCENTE' || Boolean(v.matricula), {
    message: 'Informe a matrícula.',
    path: ['matricula'],
  });

type FormValues = z.infer<typeof schema>;

interface Concluido {
  email: string;
  emailEnviado: boolean;
  /** O Lattes não chegou: o aluno anexa depois, em "Meu perfil". */
  curriculoPendente: boolean;
}

export function CadastroPage() {
  useDocumentTitle('Criar conta');
  const { register: registrar } = useAuth();
  const [erro, setErro] = useState<string | null>(null);
  const [curriculo, setCurriculo] = useState<File | null>(null);
  const [erroCurriculo, setErroCurriculo] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [concluido, setConcluido] = useState<Concluido | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'DISCENTE' } });
  const role = watch('role');

  function escolherCurriculo(file: File | undefined) {
    setCurriculo(null);
    setErroCurriculo(null);
    if (!file) return;
    const invalido = validarPdf(file);
    if (invalido) setErroCurriculo(invalido);
    else setCurriculo(file);
  }

  async function onSubmit({ confirmacao: _confirmacao, ...values }: FormValues) {
    setErro(null);
    if (values.role === 'DISCENTE' && !curriculo) {
      setErroCurriculo(erroCurriculo ?? 'Anexe seu currículo Lattes em PDF.');
      return;
    }
    try {
      const res = await registrar({
        ...values,
        departamento: values.departamento || undefined,
        matricula: values.role === 'DISCENTE' ? values.matricula || undefined : undefined,
      });

      // A conta já existe: se o Lattes falhar, o aluno anexa depois em "Meu perfil".
      let curriculoPendente = false;
      if (res.envioCurriculo && curriculo) {
        try {
          setProgresso(0);
          await enviarAoArmazenamento(res.envioCurriculo.upload, curriculo, setProgresso);
          await http.put('/api/auth/cadastro/curriculo', {
            usuarioId: res.usuarioId,
            chave: res.envioCurriculo.chave,
            nome: curriculo.name,
          });
        } catch {
          curriculoPendente = true;
        } finally {
          setProgresso(null);
        }
      }
      setConcluido({ email: res.email, emailEnviado: res.emailEnviado, curriculoPendente });
    } catch (error) {
      setErro(errorMessage(error));
    }
  }

  if (concluido) {
    return (
      <AuthLayout
        title="Confirme seu e-mail"
        subtitle="Falta só um passo para ativar sua conta."
        footer={
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Ir para a tela de entrada
          </Link>
        }
      >
        <div className="flex gap-3 rounded-lg bg-primary-soft p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-ink">
            {concluido.emailEnviado ? 'Enviamos' : 'Vamos enviar'} um link para <strong>{concluido.email}</strong>. Abra o
            e-mail (confira também o spam) e clique em <strong>Confirmar meu e-mail</strong>. O link vale por 48 horas.
          </p>
        </div>
        {!concluido.emailEnviado && (
          <Alert tone="warning" title="O e-mail não saiu agora">
            Sua conta foi criada. Use o botão abaixo para tentar enviar o link de novo.
          </Alert>
        )}
        {concluido.curriculoPendente && (
          <Alert tone="warning" title="Seu currículo não foi enviado">
            Depois de confirmar o e-mail e entrar, anexe o Lattes em <strong>Meu perfil</strong>. Ele é exigido para se
            candidatar aos projetos.
          </Alert>
        )}
        <ReenviarLink email={concluido.email} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Use seu e-mail institucional @unicap.br. Perfis de gestão são atribuídos pela Pró-Reitoria após o cadastro."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      {erro && <Alert tone="danger">{erro}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Perfil</legend>
          <div className="grid gap-2">
            {PERFIS.map((perfil) => (
              <label
                key={perfil.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition',
                  role === perfil.value ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong',
                )}
              >
                <input type="radio" value={perfil.value} className="mt-1 accent-primary" {...register('role')} />
                <span>
                  <span className="block text-sm font-semibold text-ink">{perfil.label}</span>
                  <span className="block text-xs text-ink-muted">{perfil.descricao}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Nome completo" error={errors.nome?.message} required>
          <Input autoComplete="name" {...register('nome')} />
        </Field>
        <Field label="E-mail" hint="Seu e-mail institucional, terminado em @unicap.br" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" placeholder="nome@unicap.br" {...register('email')} />
        </Field>

        {role !== 'USUARIO' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Departamento"
              hint="Sigla, ex.: DCC"
              error={errors.departamento?.message}
              required={role === 'DOCENTE'}
            >
              <Input {...register('departamento')} />
            </Field>
            {role === 'DISCENTE' && (
              <Field label="Matrícula" error={errors.matricula?.message} required>
                <Input inputMode="numeric" {...register('matricula')} />
              </Field>
            )}
          </div>
        )}

        {role === 'DISCENTE' && (
          <Field
            label="Currículo Lattes (PDF)"
            hint="Exportado da Plataforma Lattes, até 10 MB. Os professores o veem quando você se candidata."
            error={erroCurriculo ?? undefined}
            required
          >
            <Input
              type="file"
              accept="application/pdf,.pdf"
              className="file:mr-3 file:rounded file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary"
              onChange={(e) => escolherCurriculo(e.target.files?.[0])}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Senha"
            hint="Mínimo de 8 caracteres, com letras e números"
            error={errors.senha?.message}
            required
          >
            <Input type="password" autoComplete="new-password" {...register('senha')} />
          </Field>
          <Field label="Confirmar senha" error={errors.confirmacao?.message} required>
            <Input type="password" autoComplete="new-password" {...register('confirmacao')} />
          </Field>
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {progresso !== null ? `Enviando currículo... ${progresso}%` : 'Criar conta'}
        </Button>
      </form>
    </AuthLayout>
  );
}
