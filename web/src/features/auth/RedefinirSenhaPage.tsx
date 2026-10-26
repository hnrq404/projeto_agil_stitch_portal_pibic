import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { homeFor } from '@/app/navigation';
import { errorMessage, http } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import type { AuthResponse, Usuario } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Feedback';
import { Field, Input } from '@/shared/ui/Form';

import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';

/** Mesma política da API (server/src/modules/auth/dto/auth.dto.ts). */
export const senhaForte = z
  .string()
  .min(8, 'A senha precisa de ao menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')
  .refine((s) => /\p{L}/u.test(s) && /\d/.test(s), 'Combine letras e números.');

const schema = z
  .object({ novaSenha: senhaForte, confirmacao: z.string() })
  .refine((v) => v.novaSenha === v.confirmacao, { message: 'As senhas não conferem.', path: ['confirmacao'] });

type FormValues = z.infer<typeof schema>;

/** Destino do link de "esqueci minha senha". */
export function RedefinirSenhaPage() {
  useDocumentTitle('Criar nova senha');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { iniciarSessao } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit({ novaSenha }: FormValues) {
    setErro(null);
    try {
      setUsuario(iniciarSessao(await http.post<AuthResponse>('/api/auth/redefinir-senha', { token, novaSenha })));
    } catch (e) {
      setErro(errorMessage(e));
    }
  }

  if (usuario) return <Navigate to={homeFor(usuario.role)} replace />;

  return (
    <AuthLayout
      title="Criar nova senha"
      subtitle="A senha nova encerra as sessões abertas em outros aparelhos."
      footer={
        <Link to="/esqueci-senha" className="font-semibold text-primary hover:underline">
          Pedir outro link
        </Link>
      }
    >
      {!token ? (
        <Alert tone="danger">Link incompleto. Abra o link exatamente como veio no e-mail.</Alert>
      ) : (
        <>
          {erro && <Alert tone="danger">{erro}</Alert>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field
              label="Nova senha"
              hint="Mínimo de 8 caracteres, com letras e números"
              error={errors.novaSenha?.message}
              required
            >
              <Input type="password" autoComplete="new-password" autoFocus {...register('novaSenha')} />
            </Field>
            <Field label="Confirmar nova senha" error={errors.confirmacao?.message} required>
              <Input type="password" autoComplete="new-password" {...register('confirmacao')} />
            </Field>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Salvar e entrar
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
