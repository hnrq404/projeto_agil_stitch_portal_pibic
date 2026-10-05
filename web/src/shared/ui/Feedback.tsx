import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';

import { Button } from './Button';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ALERT: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-info-200 bg-info-50 text-info-900', icon: <Info className="h-5 w-5 text-info-700" aria-hidden /> },
  success: {
    box: 'border-success-200 bg-success-50 text-success-900',
    icon: <CheckCircle2 className="h-5 w-5 text-success-700" aria-hidden />,
  },
  warning: {
    box: 'border-warning-200 bg-warning-50 text-warning-900',
    icon: <AlertTriangle className="h-5 w-5 text-warning-700" aria-hidden />,
  },
  danger: { box: 'border-danger-200 bg-danger-50 text-danger-900', icon: <XCircle className="h-5 w-5 text-danger-700" aria-hidden /> },
};

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const style = ALERT[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', style.box, className)}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title ? 'mt-1' : undefined, 'space-y-1')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} aria-hidden />;
}

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[30vh] items-center justify-center gap-3 text-sm text-ink-muted">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert
      tone="danger"
      title="Não foi possível carregar"
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        )
      }
    >
      <p>{errorMessage(error)}</p>
    </Alert>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      <span className="mb-3 rounded-full bg-primary-soft p-3 text-primary" aria-hidden>
        {icon}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
