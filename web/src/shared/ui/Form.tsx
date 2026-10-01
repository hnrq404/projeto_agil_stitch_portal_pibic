import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/shared/lib/cn';

/** Marca visual de campo obrigatório (DESIGN.md: asterisco explícito). */
export const REQUIRED_MARK = "after:ml-0.5 after:text-rose-600 after:content-['*']";

interface FieldProps {
  label: string;
  /** O controle do campo; recebe id, aria-invalid e aria-describedby automaticamente. */
  children: ReactElement;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * Label no topo, asterisco nos obrigatórios e mensagem de erro ligada ao
 * controle por aria-describedby (DESIGN.md: sem float label).
 */
export function Field({ label, children, hint, error, required, className }: FieldProps) {
  const autoId = useId();
  const id = (isValidElement(children) && (children.props as { id?: string }).id) || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Asterisco via CSS: fica fora do nome acessível; a obrigatoriedade vai em aria-required. */}
      <label htmlFor={id} className={cn('block text-sm font-medium text-ink', required && REQUIRED_MARK)}>
        {label}
      </label>
      {cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn('input-base', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn('input-base pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn('input-base h-auto py-2 leading-relaxed', className)} {...rest} />;
  },
);

/** Contador de caracteres para campos com mínimo exigido pelo backend. */
export function CharCounter({ value, min, max }: { value: string; min?: number; max: number }) {
  const length = value.trim().length;
  const abaixo = min !== undefined && length < min;
  return (
    <span className={cn('tnum', abaixo ? 'text-amber-700' : 'text-ink-subtle')}>
      {length}/{max} caracteres{min !== undefined && abaixo ? ` (mínimo ${min})` : ''}
    </span>
  );
}
