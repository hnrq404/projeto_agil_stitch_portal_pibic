import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/** Nível 1 do DESIGN.md: superfície branca, borda hairline e sombra discreta. */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Nível do título (h2 por padrão) para manter a hierarquia da página. */
  as?: 'h2' | 'h3';
}

export function CardHeader({ title, eyebrow, description, actions, as: Heading = 'h2' }: CardHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{eyebrow}</p>}
        <Heading className="text-base font-semibold">{title}</Heading>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Par rótulo/valor para metadados (dl). */
export function DataItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}
