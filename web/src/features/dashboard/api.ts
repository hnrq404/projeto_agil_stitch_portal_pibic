import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { http } from '@/shared/api/http';
import type { PainelGestor } from '@/shared/types/api';

export function usePainelGestor(editalId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'gestor', editalId ?? 'todos'],
    queryFn: ({ signal }) =>
      http.get<PainelGestor>(`/api/dashboard/gestor${editalId ? `?editalId=${editalId}` : ''}`, signal),
    // Painel "vivo": atualiza sozinho a cada minuto (RNF07).
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}
