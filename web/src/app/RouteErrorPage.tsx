import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { RefreshCw, TriangleAlert } from 'lucide-react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Feedback';

import { homeFor } from './navigation';

/**
 * Falha ao baixar o código da página (rede caiu ou houve deploy novo e os
 * arquivos antigos sumiram). Recarregar resolve.
 */
function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  );
}

/** errorElement das rotas: substitui a tela padrão do React Router quando uma página quebra. */
export function RouteErrorPage() {
  useDocumentTitle('Erro');
  const error = useRouteError();
  const { user } = useAuth();

  if (import.meta.env.DEV) console.error(error);

  const chunk = isChunkLoadError(error);
  const title = chunk ? 'Não foi possível carregar esta página' : 'Algo deu errado nesta página';
  const description = chunk
    ? 'Verifique sua conexão ou recarregue: o portal pode ter sido atualizado enquanto você navegava.'
    : isRouteErrorResponse(error)
      ? `O servidor respondeu com erro ${error.status}. Tente novamente em instantes.`
      : 'Ocorreu um erro inesperado. Recarregue a página; se o problema continuar, avise a gestão do programa.';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <EmptyState
        icon={<TriangleAlert className="h-6 w-6" />}
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button icon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={() => window.location.reload()}>
              Recarregar
            </Button>
            <ButtonLink to={user ? homeFor(user.role) : '/editais'} variant="secondary">
              Ir para o início
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
