import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/shared/api/http';
import type { ListResponse, Notificacao } from '@/shared/types/api';

export const notificacoesKeys = {
  // Invalidar `all` atualiza a lista e a contagem do sino (mesmo prefixo).
  all: ['notificacoes'] as const,
  lista: ['notificacoes', 'lista'] as const,
  naoLidas: ['notificacoes', 'nao-lidas'] as const,
};

/** Lista completa: usada só na página de notificações (atualiza ao focar a aba). */
export function useNotificacoes(enabled = true) {
  return useQuery({
    queryKey: notificacoesKeys.lista,
    queryFn: ({ signal }) => http.get<ListResponse<Notificacao>>('/api/notificacoes', signal),
    enabled,
  });
}

/** Contagem do sino: consulta leve a cada 30 s, o sino reflete novos eventos sem recarregar (RNF07). */
export function useNotificacoesNaoLidas() {
  return useQuery({
    queryKey: notificacoesKeys.naoLidas,
    queryFn: ({ signal }) => http.get<{ total: number }>('/api/notificacoes/nao-lidas', signal),
    select: (res) => res.total,
    refetchInterval: 30_000,
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
