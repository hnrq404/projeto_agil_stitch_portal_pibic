import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

interface KpiTileProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Linha de contexto sob o número (ex.: "52 vagas em aberto"). */
  detail?: ReactNode;
  accent?: 'primary' | 'secondary';
}

/** Stat tile do DESIGN.md: faixa de destaque no topo, número grande tabular, rótulo em caixa alta. */
export function KpiTile({ label, value, icon, detail, accent = 'primary' }: KpiTileProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line border-t-2 bg-surface p-4 shadow-card',
        accent === 'primary' ? 'border-t-primary' : 'border-t-secondary',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</p>
        {icon && (
          <span className="text-ink-subtle" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-[28px] font-bold leading-9 text-ink tnum">{value}</p>
      {detail && <p className="mt-1 text-sm text-ink-muted">{detail}</p>}
    </div>
  );
}

interface MeterProps {
  value: number;
  max: number;
  /** Nome acessível do medidor (ex.: "Bolsas alocadas em Matemática"). */
  label: string;
  tone?: 'primary' | 'secondary' | 'warning';
  className?: string;
}

/**
 * Medidor de uma série (ocupação de cota, progresso). Barra fina com ponta
 * arredondada; o número fica sempre ao lado, em texto, nunca só na cor.
 */
export function Meter({ value, max, label, tone = 'secondary', className }: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      title={`${label}: ${value} de ${max}`}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          tone === 'primary' && 'bg-primary',
          tone === 'secondary' && 'bg-secondary',
          tone === 'warning' && 'bg-warning-500',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface CotaLinhaProps {
  nome: string;
  usadas: number;
  total: number;
  sufixo?: string;
}

/** Linha "Subárea ........ 3/4 bolsas" + medidor. */
export function CotaLinha({ nome, usadas, total, sufixo = 'bolsas' }: CotaLinhaProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-ink">{nome}</span>
        <span className="shrink-0 font-medium text-ink-muted tnum">
          {usadas}/{total} {sufixo}
        </span>
      </div>
      <Meter value={usadas} max={total} label={`${nome}: ${sufixo} alocadas`} />
    </div>
  );
}
