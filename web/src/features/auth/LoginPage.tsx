import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { ApiError, errorMessage } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Feedback';
import { Field, Input } from '@/shared/ui/Form';

import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';
import { ReenviarLink } from './ReenviarLink';

const schema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  useDocumentTitle('Entrar');
  const { login, sessionExpired } = useAuth();
  const [erro, setErro] = useState<string | null>(null);
  /** E-mail da conta que ainda não clicou no link de confirmação. */
  const [pendente, setPendente] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setErro(null);
    setPendente(null);
    try {
      // O GuestOnly redireciona assim que a sessão começa.
      await login(values.email, values.senha);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_NAO_CONFIRMADO') {
        setPendente(values.email.trim().toLowerCase());
        return;
      }
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
      {pendente && (
        <Alert tone="warning" title="Confirme seu e-mail para entrar">
          <p>
            Enviamos um link para <strong>{pendente}</strong> no cadastro. Abra o e-mail (confira o spam) e clique em
            Confirmar meu e-mail.
          </p>
          <div className="mt-3">
            <ReenviarLink email={pendente} />
          </div>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="E-mail" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" autoFocus {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.senha?.message} required>
          <Input type="password" autoComplete="current-password" {...register('senha')} />
        </Field>
        <p className="-mt-2 text-right text-sm">
          <Link to="/esqueci-senha" className="font-medium text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </p>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
