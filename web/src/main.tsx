import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createQueryClient } from '@/shared/api/query-client';
import { ToastProvider } from '@/shared/ui/Toast';

import './index.css';

const queryClient = createQueryClient();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado em index.html.');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
