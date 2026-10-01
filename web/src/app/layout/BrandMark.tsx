import { FlaskConical } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

/** Marca do portal: ícone + nome + subtítulo institucional. */
export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          inverted ? 'bg-white/10 text-white' : 'bg-primary text-white',
        )}
        aria-hidden
      >
        <FlaskConical className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className={cn('block font-display text-base font-bold', inverted ? 'text-white' : 'text-primary')}>
          Portal PIBIC
        </span>
        <span className={cn('block text-[11px] font-medium', inverted ? 'text-primary-muted' : 'text-ink-subtle')}>
          Iniciação Científica
        </span>
      </span>
    </span>
  );
}
