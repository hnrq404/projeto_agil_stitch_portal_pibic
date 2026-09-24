import { Link } from "react-router-dom";

/**
 * Página provisória para módulos entregues em sprints futuras (S2–S6).
 * Mantém a navegação por papel funcional desde a S1 sem telas vazias e
 * explica, sem jargão de projeto (Nielsen #2), o que acontece aqui.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="card flex flex-col items-center gap-3 p-10 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-teal">
        construction
      </span>
      <h1 className="text-xl font-bold text-navy">{title}</h1>
      <p className="max-w-md text-sm text-muted">
        Esta área ainda está sendo construída e será liberada nas próximas versões do portal. Nada
        do que você já cadastrou foi perdido.
      </p>
      <Link className="btn-secondary px-4" to="/ajuda">
        Ver o que já posso fazer
      </Link>
    </section>
  );
}
