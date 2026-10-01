import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { inscricoesKeys } from '@/features/inscricoes/api';
import { http } from '@/shared/api/http';
import type { AvaliadorResumo, InscricaoStatus, ItemTriagem, ListResponse } from '@/shared/types/api';

export interface FiltroTriagem {
  editalId?: string;
  status?: InscricaoStatus;
  subareaCode?: string;
}

export const triagemKeys = {
  all: ['triagem'] as const,
  fila: (f: FiltroTriagem) => ['triagem', 'fila', f] as const,
  item: (id: string) => ['triagem', 'item', id] as const,
  ranking: (editalId: string) => ['triagem', 'ranking', editalId] as const,
  avaliadores: ['triagem', 'avaliadores'] as const,
};

function query(f: FiltroTriagem): string {
  const params = new URLSearchParams();
  if (f.editalId) params.set('editalId', f.editalId);
  if (f.status) params.set('status', f.status);
  if (f.subareaCode) params.set('subareaCode', f.subareaCode);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useFilaTriagem(filtro: FiltroTriagem) {
  return useQuery({
    queryKey: triagemKeys.fila(filtro),
    queryFn: ({ signal }) => http.get<ListResponse<ItemTriagem>>(`/api/triagem${query(filtro)}`, signal),
    select: (res) => res.data,
    placeholderData: keepPreviousData,
  });
}

export function useItemTriagem(id: string | undefined) {
  return useQuery({
    queryKey: triagemKeys.item(id ?? ''),
    queryFn: ({ signal }) => http.get<ItemTriagem>(`/api/triagem/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useRanking(editalId: string | undefined) {
  return useQuery({
    queryKey: triagemKeys.ranking(editalId ?? ''),
    queryFn: ({ signal }) => http.get<ListResponse<ItemTriagem>>(`/api/triagem/editais/${editalId}/ranking`, signal),
    select: (res) => res.data,
    enabled: Boolean(editalId),
  });
}

export function useAvaliadores() {
  return useQuery({
    queryKey: triagemKeys.avaliadores,
    queryFn: ({ signal }) => http.get<ListResponse<AvaliadorResumo>>('/api/avaliadores', signal),
    select: (res) => res.data,
  });
}

/** Após qualquer ação da triagem, a fila, o item e o detalhe da inscrição ficam desatualizados. */
function useInvalidarTriagem() {
  const queryClient = useQueryClient();
  return (item?: ItemTriagem) => {
    if (item) queryClient.setQueryData(triagemKeys.item(item.inscricao.id), item);
    void queryClient.invalidateQueries({ queryKey: triagemKeys.all });
    void queryClient.invalidateQueries({ queryKey: inscricoesKeys.all });
  };
}

export function useAtribuirAvaliadores(inscricaoId: string) {
  const invalidar = useInvalidarTriagem();
  return useMutation({
    mutationFn: (avaliadorIds: string[]) =>
      http.post<ItemTriagem>(`/api/triagem/${inscricaoId}/avaliadores`, { avaliadorIds }),
    onSuccess: invalidar,
  });
}

export function useRemoverAtribuicao() {
  const invalidar = useInvalidarTriagem();
  return useMutation({
    mutationFn: (avaliacaoId: string) => http.delete(`/api/triagem/avaliacoes/${avaliacaoId}`),
    onSuccess: () => invalidar(),
  });
}

export function useHomologar(inscricaoId: string) {
  const invalidar = useInvalidarTriagem();
  return useMutation({
    mutationFn: (input: { decisao: 'APROVAR' | 'RECUSAR'; justificativa: string }) =>
      http.post<ItemTriagem>(`/api/triagem/${inscricaoId}/homologacao`, input),
    onSuccess: invalidar,
  });
}
