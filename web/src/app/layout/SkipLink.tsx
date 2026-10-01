/** Atalho "pular para o conteúdo" para teclado e leitores de tela (WCAG 2.4.1). */
export function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Pular para o conteúdo
    </a>
  );
}
