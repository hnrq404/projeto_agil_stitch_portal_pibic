import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HELP_ITEM } from "./nav";

/** Lista exibida na Central de Ajuda — mantenha em sincronia com o handler abaixo. */
export const SHORTCUTS = [
  { keys: "Alt + 1…9", action: "Abrir o item correspondente do menu lateral" },
  { keys: "?", action: "Abrir a Central de Ajuda" },
  { keys: "Esc", action: "Fechar menu, diálogo ou mensagem aberta" },
] as const;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Nielsen #7 — aceleradores para quem usa o portal todo dia, invisíveis para
 * quem está começando (documentados na Central de Ajuda e no title dos links).
 */
export function useKeyboardShortcuts(navPaths: string[]) {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || isTyping(e.target)) return;

      if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) {
        const path = navPaths[Number(e.code.slice(5)) - 1];
        if (path) {
          e.preventDefault();
          navigate(path);
        }
        return;
      }
      if (e.key === "?" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        navigate(HELP_ITEM.to);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navPaths, navigate]);
}
