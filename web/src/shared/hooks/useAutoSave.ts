import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface Options<T> {
  save: (value: T) => Promise<unknown>;
  delayMs?: number;
}

/**
 * Auto-save com debounce (RNF08 / S3.5): agenda o salvamento após a pausa na
 * digitação, salva o pendente ao sair da página e avisa antes de fechar a aba
 * com alterações não salvas.
 */
export function useAutoSave<T>({ save, delayMs = 800 }: Options<T>) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pendente = useRef<{ value: T } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const item = pendente.current;
    if (!item) return;
    pendente.current = null;
    setStatus('saving');
    try {
      await saveRef.current(item.value);
      // Só marca como salvo se nada novo chegou durante o envio.
      if (!pendente.current) {
        setStatus('saved');
        setSavedAt(new Date());
      }
    } catch {
      setStatus('error');
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pendente.current = { value };
      setStatus('pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (pendente.current) {
        event.preventDefault();
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      // Ao sair da tela pela navegação interna, salva o que ficou pendente.
      void flush();
    };
  }, [flush]);

  return { status, savedAt, schedule, flush };
}
