import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http, uploadPdf } from '@/shared/api/http';
import type { AnexoTipo, Docente, Inscricao, ListResponse, RascunhoInput } from '@/shared/types/api';

export const inscricoesKeys = {
  all: ['inscricoes'] as const,
  minhas: ['inscricoes', 'minhas'] as const,
  orientacoes: ['inscricoes', 'orientacoes'] as const,
  detalhe: (id: string) => ['inscricoes', 'detalhe', id] as const,
  docentes: ['docentes'] as const,
};

export const anexoUrl = (inscricaoId: string, anexoId: string) =>
  `/api/inscricoes/${inscricaoId}/anexos/${anexoId}/arquivo`;

export function useMinhasInscricoes() {
  return useQuery({
    queryKey: inscricoesKeys.minhas,
    queryFn: ({ signal }) => http.get<ListResponse<Inscricao>>('/api/inscricoes/minhas', signal),
    select: (res) => res.data,
  });
}

export function useOrientacoes() {
  return useQuery({
    queryKey: inscricoesKeys.orientacoes,
    queryFn: ({ signal }) => http.get<ListResponse<Inscricao>>('/api/orientacoes', signal),
    select: (res) => res.data,
  });
}

export function useInscricao(id: string | undefined) {
  return useQuery({
    queryKey: inscricoesKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => http.get<Inscricao>(`/api/inscricoes/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useDocentes() {
  return useQuery({
    queryKey: inscricoesKeys.docentes,
    queryFn: ({ signal }) => http.get<ListResponse<Docente>>('/api/usuarios/docentes', signal),
    select: (res) => res.data,
    staleTime: 5 * 60_000,
  });
}

/** Atualiza o cache do detalhe com a resposta do servidor (evita refetch após cada auto-save). */
function useSetDetalhe() {
  const queryClient = useQueryClient();
  return (inscricao: Inscricao) => {
    queryClient.setQueryData(inscricoesKeys.detalhe(inscricao.id), inscricao);
    void queryClient.invalidateQueries({ queryKey: inscricoesKeys.minhas });
  };
}

export function useCriarInscricao() {
  const setDetalhe = useSetDetalhe();
  return useMutation({
    mutationFn: (editalId: string) => http.post<Inscricao>('/api/inscricoes', { editalId }),
    onSuccess: setDetalhe,
  });
}

export function useSalvarRascunho(id: string) {
  const setDetalhe = useSetDetalhe();
  return useMutation({
    mutationFn: (input: RascunhoInput) => http.patch<Inscricao>(`/api/inscricoes/${id}`, input),
    onSuccess: setDetalhe,
  });
}

export function useEnviarAnexo(id: string) {
  const setDetalhe = useSetDetalhe();
  return useMutation({
    mutationFn: ({ tipo, file, onProgress }: { tipo: AnexoTipo; file: File; onProgress: (p: number) => void }) =>
      uploadPdf<Inscricao>(`/api/inscricoes/${id}/anexos/${tipo}`, file, onProgress),
    onSuccess: setDetalhe,
  });
}

export function useRemoverAnexo(id: string) {
  const setDetalhe = useSetDetalhe();
  return useMutation({
    mutationFn: (anexoId: string) => http.delete<Inscricao>(`/api/inscricoes/${id}/anexos/${anexoId}`),
    onSuccess: setDetalhe,
  });
}

export function useSubmeterInscricao(id: string) {
  const setDetalhe = useSetDetalhe();
  return useMutation({
    mutationFn: () => http.post<Inscricao>(`/api/inscricoes/${id}/submissao`),
    onSuccess: setDetalhe,
  });
}

export function useResponderVinculo(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { decisao: 'CONFIRMAR' | 'RECUSAR'; comentario?: string }) =>
      http.post<Inscricao>(`/api/inscricoes/${id}/vinculo`, input),
    onSuccess: (inscricao) => {
      queryClient.setQueryData(inscricoesKeys.detalhe(id), inscricao);
      void queryClient.invalidateQueries({ queryKey: inscricoesKeys.orientacoes });
    },
  });
}
