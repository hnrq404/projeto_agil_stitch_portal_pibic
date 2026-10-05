import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { errorMessage } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Feedback';
import { Field, Input } from '@/shared/ui/Form';

import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';

const PERFIS = [
  { value: 'DISCENTE', label: 'Discente', descricao: 'Vou me inscrever em editais de iniciação científica.' },
  { value: 'DOCENTE', label: 'Docente', descricao: 'Vou orientar alunos e acompanhar seus relatórios.' },
  { value: 'USUARIO', label: 'Visitante', descricao: 'Quero acompanhar editais e pesquisas publicadas.' },
] as const;

const schema = z
  .object({
    nome: z.string().trim().min(3, 'Informe o nome completo.'),
    email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
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

export function CadastroPage() {
  useDocumentTitle('Criar conta');
  const { register: registrar } = useAuth();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'DISCENTE' } });
  const role = watch('role');

  async function onSubmit({ confirmacao: _confirmacao, ...values }: FormValues) {
    setErro(null);
    try {
      await registrar({
        ...values,
        departamento: values.departamento || undefined,
        matricula: values.role === 'DISCENTE' ? values.matricula || undefined : undefined,
      });
    } catch (error) {
      setErro(errorMessage(error));
    }
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Perfis de gestão e de avaliação são atribuídos pela Pró-Reitoria após o cadastro."
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
                <input type="radio" value={perfil.value} className="mt-1 accent-[#0F294A]" {...register('role')} />
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
        <Field label="E-mail" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" {...register('email')} />
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
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  );
}
