import { cn } from '@/shared/lib/cn';
import unicapLogo from '@/assets/unicap-logo.png';

/** Marca do portal: ícone + nome + subtítulo institucional. */
export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src={unicapLogo} alt="" className="h-8 w-auto rounded-md" />
      <span className="leading-tight">
        <span className={cn('block font-display text-base font-bold', inverted ? 'text-white' : 'text-primary')}>
          Portal PIBIC
        </span>
        <span className={cn('block text-[11px] font-medium', inverted ? 'text-secondary-light' : 'text-ink-subtle')}>
          Iniciação Científica
        </span>
      </span>
    </span>
  );
}
