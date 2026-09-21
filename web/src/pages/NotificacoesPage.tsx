import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import type { Notificacao } from '../types';

/** Notificações in-app do usuário autenticado (RF07: publicação gera notificação). */
export function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await api.get<{ data: Notificacao[] }>('/api/notificacoes');
      setNotificacoes(res.data);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar notificações.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function marcarLida(id: string) {
    await api.patch(`/api/notificacoes/${id}/leitura`);
    await carregar();
  }

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Notificações</h1>
          <p className="mt-1 text-sm text-slate-500">
            {naoLidas > 0 ? `${naoLidas} não lida(s)` : 'Tudo em dia!'}
          </p>
        </div>
        <Link to="/editais" className="text-sm font-medium text-brand-600 hover:underline">
          ← Vitrine
        </Link>
      </div>

      {erro && (
        <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="mt-8 text-slate-500">Carregando…</p>
      ) : notificacoes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-medium text-slate-700">Nenhuma notificação por aqui.</p>
          <p className="mt-1 text-sm text-slate-500">
            Você será avisado quando um novo edital for publicado.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {notificacoes.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border p-4 shadow-sm ${
                n.lida ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {!n.lida && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-600" />}
                    {n.titulo}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{n.mensagem}</p>
                  {n.referenceId && (
                    <Link
                      to={`/editais/${n.referenceId}`}
                      className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline"
                    >
                      Ver edital →
                    </Link>
                  )}
                </div>
                {!n.lida && (
                  <button
                    type="button"
                    onClick={() => void marcarLida(n.id)}
                    className="shrink-0 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    Marcar lida
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
