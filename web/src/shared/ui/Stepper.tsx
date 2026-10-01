import { Check } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

interface StepperProps {
  steps: readonly string[];
  current: number;
  /** Etapas já visitadas podem ser reabertas pelo clique. */
  onSelect?: (index: number) => void;
  maxReached: number;
}

/** Trilha de etapas do DESIGN.md: concluída = check verde, atual = borda navy. */
export function Stepper({ steps, current, onSelect, maxReached }: StepperProps) {
  return (
    <nav aria-label="Etapas da inscrição">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = onSelect && index <= maxReached && !active;
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect?.(index)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition',
                  clickable ? 'hover:bg-primary-soft' : 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold tnum',
                    done && 'border-secondary bg-secondary text-white',
                    active && 'border-primary bg-surface text-primary',
                    !done && !active && 'border-line-strong bg-surface text-ink-subtle',
                  )}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
                </span>
                <span className={cn(active ? 'font-semibold text-ink' : 'text-ink-muted')}>
                  {label}
                  {done && <span className="sr-only"> (concluída)</span>}
                </span>
              </button>
              {index < steps.length - 1 && <span className="hidden h-px w-6 bg-line-strong sm:block" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
