import { useEffect } from 'react';

/** Título da aba = página atual (WCAG 2.4.2), restaurado ao sair. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const anterior = document.title;
    document.title = `${title} | Portal PIBIC`;
    return () => {
      document.title = anterior;
    };
  }, [title]);
}
