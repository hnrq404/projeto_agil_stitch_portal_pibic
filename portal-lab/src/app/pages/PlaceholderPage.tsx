/**
 * Página provisória para módulos entregues em sprints futuras (S2–S6).
 * Mantém a navegação por papel funcional desde a S1 sem telas vazias.
 */
export function PlaceholderPage({ title, sprint }: { title: string; sprint: string }) {
  return (
    <section className="card flex flex-col items-center gap-3 p-10 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-teal">
        construction
      </span>
      <h1 className="text-xl font-bold text-navy">{title}</h1>
      <p className="max-w-md text-sm text-muted">
        Módulo previsto para a <strong>{sprint}</strong> conforme o plano
        (<code className="font-mono text-xs">institutional_scientific_portal/Sprints.md</code>).
        A navegação, autenticação e o controle de acesso por papel já estão ativos.
      </p>
    </section>
  );
}
