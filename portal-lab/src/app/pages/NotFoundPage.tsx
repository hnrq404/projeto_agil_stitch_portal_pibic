import { Link, useLocation } from "react-router-dom";

/**
 * Rota inexistente (Nielsen #9): em vez de redirecionar em silêncio, explica
 * que o endereço não existe e oferece caminhos de saída.
 */
export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[48px] text-amber">
        explore_off
      </span>
      <h1 className="font-display text-2xl font-bold text-navy">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted">
        O endereço <span className="font-mono text-xs text-ink">{pathname}</span> não existe no
        portal. Ele pode ter sido digitado errado ou a página mudou de lugar.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link className="btn-primary px-4" to="/">
          Ir para a página inicial
        </Link>
        <Link className="btn-secondary px-4" to="/ajuda">
          Abrir Central de Ajuda
        </Link>
      </div>
    </div>
  );
}
