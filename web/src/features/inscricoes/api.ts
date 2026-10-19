import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http, uploadPdf } from '@/shared/api/http';
import type {
  AnexoTipo,
  Candidatura,
  Inscricao,
  ListResponse,
  ProjetoDivulgado,
  RascunhoInput,
} from '@/shared/types/api';

/** Projetos de pesquisa do professor (o recurso da API ainda se chama "inscrições"). */
export const inscricoesKeys = {
  all: ['inscricoes'] as const,
  minhas: ['inscricoes', 'minhas'] as const,
  detalhe: (id: string) => ['inscricoes', 'detalhe', id] as const,
  candidaturas: (id: string) => ['inscricoes', 'candidaturas', id] as const,
};

export const candidaturasKeys = {
  all: ['candidaturas'] as const,
  minhas: ['candidaturas', 'minhas'] as const,
  divulgados: (filtro: FiltroDivulgados) => ['candidaturas', 'divulgados', filtro] as const,
};

export const anexoUrl = (inscricaoId: string, anexoId: string) =>
  `/api/inscricoes/${inscricaoId}/anexos/${anexoId}/arquivo`;

// ── Professor ──────────────────────────────────────────────────────────────

export function useMinhasInscricoes(enabled = true) {
  return useQuery({
    queryKey: inscricoesKeys.minhas,
    queryFn: ({ signal }) => http.get<ListResponse<Inscricao>>('/api/inscricoes/minhas', signal),
    select: (res) => res.data,
    enabled,
  });
}

export function useInscricao(id: string | undefined) {
  return useQuery({
    queryKey: inscricoesKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => http.get<Inscricao>(`/api/inscricoes/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useCandidaturasDoProjeto(id: string, enabled: boolean) {
  return useQuery({
    queryKey: inscricoesKeys.candidaturas(id),
    queryFn: ({ signal }) => http.get<ListResponse<Candidatura>>(`/api/inscricoes/${id}/candidaturas`, signal),
    select: (res) => res.data,
    enabled,
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

export function useDivulgarProjeto(id: string) {
  const setDetalhe = useSetDetalhe();
  return useMutation({
    mutationFn: () => http.post<Inscricao>(`/api/inscricoes/${id}/divulgacao`),
    onSuccess: setDetalhe,
  });
}

export function useSelecionarAluno(id: string) {
  const setDetalhe = useSetDetalhe();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidaturaId: string) => http.post<Inscricao>(`/api/inscricoes/${id}/selecao`, { candidaturaId }),
    onSuccess: (inscricao) => {
      setDetalhe(inscricao);
      void queryClient.invalidateQueries({ queryKey: inscricoesKeys.candidaturas(id) });
    },
  });
}

/** Envio ao edital com os três professores avaliadores. */
export function useEnviarAoEdital(id: string) {
  const setDetalhe = useSetDetalhe();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (avaliadorIds: string[]) => http.post<Inscricao>(`/api/inscricoes/${id}/submissao`, { avaliadorIds }),
    onSuccess: (inscricao) => {
      setDetalhe(inscricao);
      void queryClient.invalidateQueries({ queryKey: inscricoesKeys.candidaturas(id) });
    },
  });
}

// ── Aluno ──────────────────────────────────────────────────────────────────

export interface FiltroDivulgados {
  editalId?: string;
  q?: string;
}

/** Projetos divulgados com vaga (rota pública: visitantes também veem). */
export function useProjetosDivulgados(filtro: FiltroDivulgados = {}) {
  const params = new URLSearchParams();
  if (filtro.editalId) params.set('editalId', filtro.editalId);
  if (filtro.q) params.set('q', filtro.q);
  const qs = params.toString();
  return useQuery({
    queryKey: candidaturasKeys.divulgados(filtro),
    queryFn: ({ signal }) =>
      http.get<ListResponse<ProjetoDivulgado>>(`/api/publico/projetos${qs ? `?${qs}` : ''}`, signal),
    select: (res) => res.data,
  });
}

export function useMinhasCandidaturas(enabled = true) {
  return useQuery({
    queryKey: candidaturasKeys.minhas,
    queryFn: ({ signal }) => http.get<ListResponse<Candidatura>>('/api/candidaturas/minhas', signal),
    select: (res) => res.data,
    enabled,
  });
}

export function useCandidatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projetoId, mensagem }: { projetoId: string; mensagem: string }) =>
      http.post<Candidatura>(`/api/inscricoes/${projetoId}/candidaturas`, { mensagem }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: candidaturasKeys.minhas }),
  });
}

export function useDesistirCandidatura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidaturaId: string) => http.delete<void>(`/api/candidaturas/${candidaturaId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: candidaturasKeys.minhas }),
  });
}
