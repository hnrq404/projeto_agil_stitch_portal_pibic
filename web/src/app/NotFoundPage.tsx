import { Compass } from 'lucide-react';

import { useAuth } from '@/features/auth/AuthProvider';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { ButtonLink } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/Feedback';

import { homeFor } from './navigation';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');
  const { user } = useAuth();
  return (
    <div className="py-10">
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="Página não encontrada"
        description="O endereço pode ter mudado ou o conteúdo não está disponível para o seu perfil."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink to={user ? homeFor(user.role) : '/editais'}>Ir para o início</ButtonLink>
            <ButtonLink to="/pesquisas" variant="secondary">
              Vitrine de pesquisas
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
