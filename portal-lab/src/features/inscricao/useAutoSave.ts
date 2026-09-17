import { useEffect, useRef, useState } from "react";

/**
 * Auto-save do rascunho (S3.5 / RNF08): dispara a mutation após 1,5 s sem
 * digitação e expõe o estado para o indicador "Salvando… / Rascunho salvo".
 * Não sobrescreve mudanças feitas enquanto um save anterior estava em voo
 * (o efeito é reagendado quando `dados` muda durante o save).
 */
export type AutoSaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function useAutoSave<T extends Record<string, unknown>>(
  dados: T | null,
  salvar: (dados: T) => Promise<unknown>,
  { delayMs = 1500 }: { delayMs?: number } = {},
): AutoSaveState {
  const [state, setState] = useState<AutoSaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;

  useEffect(() => {
    if (!dados) {
      return;
    }
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState("saving");
      salvarRef
        .current(dados)
        .then(() => setState("saved"))
        .catch(() => setState("error"));
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dados, delayMs]);

  return state;
}
