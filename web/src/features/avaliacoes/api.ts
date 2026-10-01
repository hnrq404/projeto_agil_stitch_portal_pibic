import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/shared/api/http';
import type {
  Avaliacao,
  AvaliacaoComInscricao,
  AvaliacaoDetalhe,
  Criterio,
  ListResponse,
  NotaCriterio,
} from '@/shared/types/api';

export const avaliacoesKeys = {
  all: ['avaliacoes'] as const,
  minhas: ['avaliacoes', 'minhas'] as const,
  detalhe: (id: string) => ['avaliacoes', 'detalhe', id] as const,
  criterios: ['avaliacoes', 'criterios'] as const,
};

export function useCriterios() {
  return useQuery({
    queryKey: avaliacoesKeys.criterios,
    queryFn: ({ signal }) => http.get<{ data: Criterio[] }>('/api/avaliacoes/criterios', signal),
    select: (res) => res.data,
    staleTime: Infinity,
  });
}

export function useMinhasAvaliacoes() {
  return useQuery({
    queryKey: avaliacoesKeys.minhas,
    queryFn: ({ signal }) => http.get<ListResponse<AvaliacaoComInscricao>>('/api/avaliacoes/minhas', signal),
    select: (res) => res.data,
  });
}

export function useAvaliacao(id: string | undefined) {
  return useQuery({
    queryKey: avaliacoesKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => http.get<AvaliacaoDetalhe>(`/api/avaliacoes/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useEmitirParecer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { notas: NotaCriterio[]; parecer: string }) =>
      http.post<Avaliacao>(`/api/avaliacoes/${id}/parecer`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: avaliacoesKeys.all }),
  });
}
