import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './http';

/**
 * Estado de servidor via TanStack Query: cache, revalidação ao focar a aba
 * (dados "quase em tempo real", RNF07) e sem retry em erros de regra/permissão.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
