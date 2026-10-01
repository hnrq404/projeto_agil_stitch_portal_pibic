import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/shared/api/http';
import type {
  CnpqArea,
  Edital,
  EditalInput,
  EditalPublico,
  EditalStatus,
  ListResponse,
} from '@/shared/types/api';

export const editaisKeys = {
  all: ['editais'] as const,
  gestor: (status?: EditalStatus) => ['editais', 'gestor', status ?? 'todos'] as const,
  detalhe: (id: string) => ['editais', 'detalhe', id] as const,
  publicos: ['editais', 'publicos'] as const,
  publico: (id: string) => ['editais', 'publico', id] as const,
  areas: ['cnpq-areas'] as const,
};

export function useCnpqAreas() {
  return useQuery({
    queryKey: editaisKeys.areas,
    queryFn: ({ signal }) => http.get<ListResponse<CnpqArea>>('/api/cnpq/areas', signal),
    staleTime: Infinity,
    select: (res) => res.data,
  });
}

export function useEditaisGestor(status?: EditalStatus) {
  return useQuery({
    queryKey: editaisKeys.gestor(status),
    queryFn: ({ signal }) =>
      http.get<ListResponse<Edital>>(`/api/editais${status ? `?status=${status}` : ''}`, signal),
    select: (res) => res.data,
  });
}

export function useEdital(id: string | undefined) {
  return useQuery({
    queryKey: editaisKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => http.get<Edital>(`/api/editais/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useEditaisPublicos() {
  return useQuery({
    queryKey: editaisKeys.publicos,
    queryFn: ({ signal }) => http.get<ListResponse<EditalPublico>>('/api/publico/editais', signal),
    select: (res) => res.data,
  });
}

export function useEditalPublico(id: string | undefined) {
  return useQuery({
    queryKey: editaisKeys.publico(id ?? ''),
    queryFn: ({ signal }) => http.get<EditalPublico>(`/api/publico/editais/${id}`, signal),
    enabled: Boolean(id),
  });
}

/** Cria ou atualiza; com `publicar`, publica em seguida (mesma ação do botão "Salvar e Publicar"). */
export function useSalvarEdital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, publicar }: { id?: string; input: EditalInput; publicar: boolean }) => {
      const salvo = id
        ? await http.patch<Edital>(`/api/editais/${id}`, input)
        : await http.post<Edital>('/api/editais', input);
      return publicar ? http.post<Edital>(`/api/editais/${salvo.id}/transicoes`, { acao: 'publicar' }) : salvo;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: editaisKeys.all }),
  });
}

export function useTransicaoEdital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: 'publicar' | 'encerrar' }) =>
      http.post<Edital>(`/api/editais/${id}/transicoes`, { acao }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: editaisKeys.all }),
  });
}
