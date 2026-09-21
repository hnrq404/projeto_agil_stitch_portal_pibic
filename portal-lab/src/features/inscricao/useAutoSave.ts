import { useEffect, useRef, useState } from "react";

/**
 * Auto-save do rascunho (S3.5 / RNF08): dispara a mutation após 1,5 s sem
 * digitação e expõe o estado para o indicador "Salvando… / Rascunho salvo".
 * Não sobrescreve mudanças feitas enquanto um save anterior estava em voo
 * (o efeito é reagendado quando `dados` muda durante o save).
 *
 * Flush no fechamento da aba: pagehide/visibilitychange disparam um save
 * imediato do último estado, e o unmount cancela o timer pendente. O
 * Convex reenvia a mutation se o processo morrer no meio do fetch, por
 * isso é seguro disparar sem aguardar a resposta.
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
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  const pendenteRef = useRef(false);

  useEffect(() => {
    if (!dados) {
      return;
    }
    pendenteRef.current = true;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pendenteRef.current = false;
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

  // RNF08 — fecha a janela de perda do debounce: qualquer sinal de saída
  // (fechar aba, navegar, minimizar no mobile) salva imediatamente.
  useEffect(() => {
    function flush() {
      if (timer.current) clearTimeout(timer.current);
      if (pendenteRef.current && dadosRef.current) {
        pendenteRef.current = false;
        void salvarRef.current(dadosRef.current).catch(() => {
          /* sem UI no pagehide; o próximo ciclo reporta o erro */
        });
      }
    }
    const aoEsconder = (e: Event) => {
      // persisted=false => a página está sendo destruída de verdade.
      const ev = e as PageTransitionEvent;
      if (ev.persisted !== true) flush();
    };
    const aoOcultar = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", aoEsconder);
    document.addEventListener("visibilitychange", aoOcultar);
    return () => {
      flush(); // unmount: salva o que ficou pendente
      window.removeEventListener("pagehide", aoEsconder);
      document.removeEventListener("visibilitychange", aoOcultar);
    };
  }, []);

  return state;
}