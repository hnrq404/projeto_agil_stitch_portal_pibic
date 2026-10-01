import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/shared/api/http';
import type { ListResponse, Notificacao } from '@/shared/types/api';

export const notificacoesKeys = {
  all: ['notificacoes'] as const,
};

/** Atualiza a cada 30 s e ao focar a aba: o sino reflete novos eventos sem recarregar (RNF07). */
export function useNotificacoes(enabled = true) {
  return useQuery({
    queryKey: notificacoesKeys.all,
    queryFn: ({ signal }) => http.get<ListResponse<Notificacao>>('/api/notificacoes', signal),
    refetchInterval: 30_000,
    enabled,
  });
}

export function useMarcarLida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.patch(`/api/notificacoes/${id}/leitura`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificacoesKeys.all }),
  });
}

export function useMarcarTodasLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.post<{ marcadas: number }>('/api/notificacoes/leitura'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificacoesKeys.all }),
  });
}

/** Para onde cada notificação leva o usuário. */
export function destinoDaNotificacao(n: Notificacao): string | null {
  if (!n.referenceId) return null;
  switch (n.tipo) {
    case 'EDITAL_PUBLICADO':
    case 'EDITAL_ENCERRADO':
      return `/editais/${n.referenceId}`;
    case 'VINCULO_SOLICITADO':
    case 'VINCULO_RESPONDIDO':
    case 'INSCRICAO_RESULTADO':
      return `/inscricoes/${n.referenceId}`;
    case 'AVALIACAO_ATRIBUIDA':
      return '/avaliacoes';
    case 'RELATORIO_ENVIADO':
    case 'RELATORIO_AVALIADO':
      return `/projetos/${n.referenceId}`;
  }
}
