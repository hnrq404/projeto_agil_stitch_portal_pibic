import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { errorMessage } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Feedback';
import { Field, Input } from '@/shared/ui/Form';

import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  useDocumentTitle('Entrar');
  const { login, sessionExpired } = useAuth();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErro(null);
    try {
      // O GuestOnly redireciona assim que a sessão começa.
      await login(values.email, values.senha);
    } catch (error) {
      setErro(errorMessage(error));
    }
  }

  return (
    <AuthLayout
      title="Entrar no Portal PIBIC"
      subtitle="Use o e-mail institucional cadastrado."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-primary hover:underline">
            Cadastre-se
          </Link>
        </>
      }
    >
      {sessionExpired && !erro && (
        <Alert tone="warning" title="Sua sessão expirou">
          Entre novamente para continuar de onde parou.
        </Alert>
      )}
      {erro && <Alert tone="danger">{erro}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="E-mail" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" autoFocus {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.senha?.message} required>
          <Input type="password" autoComplete="current-password" {...register('senha')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
