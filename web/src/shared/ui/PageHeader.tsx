import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';

interface PageHeaderProps {
  title: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}

/** Cabeçalho padrão das páginas: título único (h1) que também nomeia a aba. */
export function PageHeader({ title, eyebrow, description, actions, back }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <header className="mb-6 space-y-3">
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-secondary-strong">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-bold sm:text-[28px] sm:leading-9">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-ink-muted sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
