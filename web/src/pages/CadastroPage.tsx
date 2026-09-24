import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../types';

/** Página de Cadastro — salva a conta no banco (bcrypt) e leva para o login. */
export function CadastroPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [role, setRole] = useState<UserRole>('USUARIO');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const senhasDivergentes = confirmacao.length > 0 && confirmacao !== senha;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);

    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setEnviando(true);
    try {
      // Cadastro já autentica (token JWT emitido no registro) e leva ao destino por papel.
      await register({ nome, email, senha, role });
      navigate(role === 'GESTOR' ? '/gestor/editais' : '/editais', { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no cadastro.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-900">Criar conta</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registre-se para acompanhar editais ou gerenciar publicações como gestor.
        </p>

        {erro && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-slate-700">
              Nome completo
            </label>
            <input
              id="nome"
              type="text"
              required
              minLength={3}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-slate-700">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
            <div>
              <label htmlFor="confirmacao" className="block text-sm font-medium text-slate-700">
                Confirmar senha
              </label>
              <input
                id="confirmacao"
                type="password"
                required
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                className={`mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600/20 ${
                  senhasDivergentes ? 'border-red-400' : 'border-slate-300 focus:border-brand-600'
                }`}
              />
              {senhasDivergentes && (
                <p className="mt-1 text-xs text-red-600">As senhas não coincidem.</p>
              )}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700">Perfil</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  role === 'USUARIO' ? 'border-brand-600 bg-brand-50' : 'border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="USUARIO"
                  checked={role === 'USUARIO'}
                  onChange={() => setRole('USUARIO')}
                />
                Visitante
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  role === 'GESTOR' ? 'border-brand-600 bg-brand-50' : 'border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="GESTOR"
                  checked={role === 'GESTOR'}
                  onChange={() => setRole('GESTOR')}
                />
                Gestor
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Gestor pode criar e publicar editais; visitante acompanha a vitrine.
            </p>
          </div>

          <button
            type="submit"
            disabled={enviando || senhasDivergentes}
            className="w-full rounded-md bg-brand-600 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {enviando ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Já possui conta?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Faça Login
          </Link>
        </p>
      </div>
    </div>
  );
}
