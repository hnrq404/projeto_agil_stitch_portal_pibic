import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchBlob, http, saveBlob, uploadPdf } from '@/shared/api/http';
import type { Inscricao, ListResponse, ProjetoDetalhe, Relatorio, RelatorioTipo } from '@/shared/types/api';

export const projetosKeys = {
  all: ['projetos'] as const,
  lista: ['projetos', 'lista'] as const,
  detalhe: (id: string) => ['projetos', 'detalhe', id] as const,
};

export const relatorioUrl = (projetoId: string, relatorioId: string) =>
  `/api/projetos/${projetoId}/relatorios/${relatorioId}/arquivo`;

export function useProjetos() {
  return useQuery({
    queryKey: projetosKeys.lista,
    queryFn: ({ signal }) => http.get<ListResponse<Inscricao>>('/api/projetos', signal),
    select: (res) => res.data,
  });
}

export function useProjeto(id: string | undefined) {
  return useQuery({
    queryKey: projetosKeys.detalhe(id ?? ''),
    queryFn: ({ signal }) => http.get<ProjetoDetalhe>(`/api/projetos/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useEnviarRelatorio(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, file, onProgress }: { tipo: RelatorioTipo; file: File; onProgress: (p: number) => void }) =>
      uploadPdf<Relatorio>(`/api/projetos/${id}/relatorios/${tipo}`, file, onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projetosKeys.detalhe(id) }),
  });
}

export function useAvaliarRelatorio(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ relatorioId, ...input }: { relatorioId: string; decisao: 'APROVAR' | 'DEVOLVER'; comentario: string }) =>
      http.post<Relatorio>(`/api/projetos/${id}/relatorios/${relatorioId}/avaliacao`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projetosKeys.detalhe(id) }),
  });
}

/** RF22: CSV para prestação de contas (matrícula mascarada no servidor, RN09). */
export async function exportarProjetosCsv(editalId?: string): Promise<void> {
  const blob = await fetchBlob(`/api/projetos/exportacao.csv${editalId ? `?editalId=${editalId}` : ''}`);
  saveBlob(blob, `projetos-pibic-${new Date().toISOString().slice(0, 10)}.csv`);
}
