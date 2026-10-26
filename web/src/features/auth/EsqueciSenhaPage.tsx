import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';

import { errorMessage, http } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Feedback';
import { Field, Input } from '@/shared/ui/Form';

import { AuthLayout } from './AuthLayout';

const schema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
});

type FormValues = z.infer<typeof schema>;

export function EsqueciSenhaPage() {
  useDocumentTitle('Esqueci minha senha');
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit({ email }: FormValues) {
    setErro(null);
    try {
      await http.post('/api/auth/esqueci-senha', { email });
      setEnviadoPara(email);
    } catch (e) {
      setErro(errorMessage(e));
    }
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Enviamos um link para você criar uma senha nova."
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Voltar para a entrada
        </Link>
      }
    >
      {enviadoPara ? (
        <div className="flex gap-3 rounded-lg bg-primary-soft p-4" role="status">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-ink">
            Se houver uma conta com <strong>{enviadoPara}</strong>, o link chega em instantes (confira também o spam). Ele
            vale por 1 hora.
          </p>
        </div>
      ) : (
        <>
          {erro && <Alert tone="danger">{erro}</Alert>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="E-mail" error={errors.email?.message} required>
              <Input type="email" autoComplete="email" autoFocus {...register('email')} />
            </Field>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Enviar link
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
