import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import type { Edital } from '../types';

const STATUS_STYLE: Record<string, string> = {
  RASCUNHO: 'bg-amber-100 text-amber-700',
  PUBLICADO: 'bg-green-100 text-green-700',
  ENCERRADO: 'bg-slate-200 text-slate-600',
};

/** Painel do Gestor — CRUD + transições de estado dos editais (protegido por RBAC). */
export function GestorEditaisPage() {
  const [editais, setEditais] = useState<Edital[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await api.get<{ data: Edital[] }>('/api/editais');
      setEditais(res.data);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar editais.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handlePublicar(edital: Edital) {
    setPublicandoId(edital.id);
    setErro(null);
    try {
      await api.post<Edital>(`/api/editais/${edital.id}/publicar`);
      await carregar(); // reflete status + notificações geradas
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao publicar.');
    } finally {
      setPublicandoId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Painel do Gestor</h1>
          <p className="mt-1 text-slate-500">Gerencie editais, cotas e publicações.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/editais"
            className="rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
          >
            Ver Vitrine Pública
          </Link>
          <Link
            to="/gestor/editais/novo"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Criar Novo Edital
          </Link>
        </div>
      </div>

      {erro && (
        <p role="alert" className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="mt-8 text-slate-500">Carregando editais…</p>
      ) : editais.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-medium text-slate-700">Nenhum edital criado ainda.</p>
          <Link
            to="/gestor/editais/novo"
            className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Criar o primeiro edital
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                <th className="px-4 py-3">Edital</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Bolsas</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {editais.map((edital) => (
                <tr key={edital.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{edital.titulo}</p>
                    <p className="text-xs text-slate-400">{edital.numero} · {edital.tipoBolsa}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[edital.status] ?? ''}`}
                    >
                      {edital.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{edital.totalCotas}</td>
                  <td className="px-4 py-3">
                    {new Date(edital.dataFimInscricoes).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/gestor/editais/${edital.id}`}
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Ver Detalhes
                      </Link>
                      {edital.status === 'RASCUNHO' && (
                        <>
                          <Link
                            to={`/gestor/editais/${edital.id}/editar`}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Editar
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handlePublicar(edital)}
                            disabled={publicandoId === edital.id}
                            className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {publicandoId === edital.id ? 'Publicando…' : 'Publicar'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
