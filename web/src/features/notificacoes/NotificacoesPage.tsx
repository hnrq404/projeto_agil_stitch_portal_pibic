import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';

import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { formatDateTime } from '@/shared/lib/format';
import type { Notificacao } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/Feedback';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useToast } from '@/shared/ui/Toast';

import { destinoDaNotificacao, useMarcarLida, useMarcarTodasLidas, useNotificacoes } from './api';

export function NotificacoesPage() {
  const { data, isPending, isError, error, refetch } = useNotificacoes();
  const marcarLida = useMarcarLida();
  const marcarTodas = useMarcarTodasLidas();
  const navigate = useNavigate();
  const toast = useToast();
  const naoLidas = data?.data.filter((n) => !n.lida).length ?? 0;

  function abrir(n: Notificacao) {
    if (!n.lida) marcarLida.mutate(n.id);
    const destino = destinoDaNotificacao(n);
    if (destino) navigate(destino);
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        description={naoLidas > 0 ? `${naoLidas} não lida(s).` : 'Você está em dia.'}
        actions={
          naoLidas > 0 && (
            <Button
              variant="secondary"
              icon={<CheckCheck className="h-4 w-4" aria-hidden />}
              loading={marcarTodas.isPending}
              onClick={() => marcarTodas.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
            >
              Marcar todas como lidas
            </Button>
          )
        }
      />
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="Nenhuma notificação"
          description="Avisos sobre editais, inscrições, avaliações e relatórios aparecem aqui."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {data.data.map((n) => {
              const destino = destinoDaNotificacao(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => abrir(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-canvas',
                      !n.lida && 'bg-primary-soft/40',
                    )}
                  >
                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.lida ? 'bg-transparent' : 'bg-primary')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', n.lida ? 'text-ink' : 'font-semibold text-ink')}>
                        {n.titulo}
                        {!n.lida && <span className="sr-only"> (não lida)</span>}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-muted">{n.mensagem}</span>
                      <span className="mt-1 block text-xs text-ink-subtle">
                        {formatDateTime(n.criadoEm)}
                        {destino && <span className="ml-2 font-medium text-primary">Abrir</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
