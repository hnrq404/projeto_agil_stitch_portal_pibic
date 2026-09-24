import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

/** Página de Login — redireciona GESTOR para o painel e demais para a vitrine. */
export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const logged = await login(email, senha);
      // Redirecionamento inteligente por papel (ou rota de origem protegida).
      if (from) {
        navigate(from, { replace: true });
      } else if (logged.role === 'GESTOR') {
        navigate('/gestor/editais', { replace: true });
      } else {
        navigate('/editais', { replace: true });
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-900">Entrar no Portal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acesse como gestor para administrar editais ou como visitante para acompanhar publicações.
        </p>

        {user && (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Você já está autenticado como <strong>{user.nome}</strong>.
          </p>
        )}
        {erro && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@instituicao.edu.br"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </div>
          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-brand-600 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Não tem uma conta?{' '}
          <Link to="/cadastro" className="font-semibold text-brand-600 hover:underline">
            Cadastre-se
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link to="/editais" className="text-slate-500 hover:underline">
            Continuar sem login → ver editais abertos
          </Link>
        </p>
      </div>
    </div>
  );
}
