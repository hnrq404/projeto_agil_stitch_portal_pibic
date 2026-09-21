import { Link } from 'react-router-dom';

/** 404 — nenhuma rota é um beco sem saída. */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <p className="text-5xl">🧭</p>
      <h1 className="mt-4 text-2xl font-bold text-brand-900">Página não encontrada</h1>
      <p className="mt-2 text-slate-500">
        O endereço acessado não existe ou foi movido.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/editais"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Ver editais abertos
        </Link>
        <Link
          to="/login"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Fazer login
        </Link>
      </div>
    </div>
  );
}
