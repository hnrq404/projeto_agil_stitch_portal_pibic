import { cn } from '@/shared/lib/cn';

interface FilterPillsProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}

/** Filtros rápidos em pílula (DESIGN.md): inativa = cinza, ativa = navy. */
export function FilterPills<T extends string>({ label, options, value, onChange }: FilterPillsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
              active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tnum',
                  active ? 'bg-white/20 text-white' : 'bg-white text-slate-600',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
