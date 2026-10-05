import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import type { StatusInfo, Tone } from '@/shared/lib/labels';

const TONE: Record<Tone, { pill: string; dot: string }> = {
  success: { pill: 'border-success-200 bg-success-50 text-success-800', dot: 'bg-success-500' },
  warning: { pill: 'border-warning-200 bg-warning-50 text-warning-800', dot: 'bg-warning-500' },
  neutral: { pill: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' },
  danger: { pill: 'border-danger-200 bg-danger-50 text-danger-800', dot: 'bg-danger-500' },
  info: { pill: 'border-info-200 bg-info-50 text-info-800', dot: 'bg-info-500' },
};

/** Pílula de status: cor + texto + ponto (o estado nunca depende só da cor). */
export function StatusBadge({ status, className }: { status: StatusInfo; className?: string }) {
  const tone = TONE[status.tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tone.pill,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
      {status.label}
    </span>
  );
}

/** Etiqueta retangular (subárea, tipo de bolsa, departamento). */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary', className)}>
      {children}
    </span>
  );
}

/** Identificadores de processo (protocolo, número do edital) em JetBrains Mono. */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-xs text-ink-muted', className)}>
      {children}
    </span>
  );
}
