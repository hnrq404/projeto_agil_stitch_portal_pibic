import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import { homeFor } from '@/app/navigation';
import { errorMessage, http } from '@/shared/api/http';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import type { AuthResponse, Usuario } from '@/shared/types/api';
import { Alert, LoadingState } from '@/shared/ui/Feedback';

import { useAuth } from './AuthProvider';
import { AuthLayout } from './AuthLayout';

/** Destino do link enviado no cadastro: confirma o e-mail e já entra na conta. */
export function VerificarEmailPage() {
  useDocumentTitle('Confirmar e-mail');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { iniciarSessao } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [erro, setErro] = useState<string | null>(token ? null : 'Link incompleto. Abra o link exatamente como veio no e-mail.');
  // Em desenvolvimento o React monta o efeito duas vezes; o link só pode ser usado uma.
  const enviado = useRef(false);

  useEffect(() => {
    if (!token || enviado.current) return;
    enviado.current = true;
    http
      .post<AuthResponse>('/api/auth/verificar-email', { token })
      .then((res) => setUsuario(iniciarSessao(res)))
      .catch((e: unknown) => setErro(errorMessage(e)));
  }, [token, iniciarSessao]);

  if (usuario) return <Navigate to={homeFor(usuario.role)} replace />;

  return (
    <AuthLayout
      title="Confirmar e-mail"
      subtitle="Ativando sua conta no Portal PIBIC."
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Ir para a tela de entrada
        </Link>
      }
    >
      {erro ? (
        <Alert tone="danger" title="Não foi possível confirmar">
          <p>{erro}</p>
          <p className="mt-2">Na tela de entrada, informe e-mail e senha para receber um novo link.</p>
        </Alert>
      ) : (
        <LoadingState label="Confirmando seu e-mail..." />
      )}
    </AuthLayout>
  );
}
