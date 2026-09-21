import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Edital } from '../types';

/** Vitrine Pública — apenas editais PUBLICADO com prazo vigente (RF08). */
export function VitrinePage() {
  const { user, isGestor } = useAuth();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: Edital[] }>('/api/publico/editais')
      .then((res) => {
        if (!cancelled) setEditais(res.data);
      })
      .catch((err: Error) => {
        if (!cancelled) setErro(err.message);
      })
      .finally(() => {
        if (!cancelled) setCarregando(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const destinosGestor = user?.role === 'GESTOR' ? '/gestor/editais' : '/login';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-brand-900">Editais Abertos</h1>
          <p className="mt-1 text-slate-500">
            Oportunidades de iniciação científica com inscrições vigentes.
          </p>
        </div>
        <Link
          to={destinosGestor}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {isGestor ? 'Ir para o Painel do Gestor' : 'Área do Gestor'}
        </Link>
      </div>

      {carregando && <p className="mt-8 text-slate-500">Carregando editais…</p>}
      {erro && (
        <p role="alert" className="mt-8 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      {!carregando && editais.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-medium text-slate-700">Nenhum edital aberto no momento.</p>
          <p className="mt-1 text-sm text-slate-500">
            Volte em breve ou verifique as notificações após publicações.
          </p>
          {!user && (
            <Link to="/cadastro" className="mt-4 inline-block font-medium text-brand-600 hover:underline">
              Criar uma conta para ser notificado →
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {editais.map((edital) => (
          <article
            key={edital.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                INSCRIÇÕES ABERTAS
              </span>
              <span className="text-xs font-medium text-slate-400">{edital.numero}</span>
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-800">{edital.titulo}</h2>
            <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">
              {edital.descricao || 'Sem descrição.'}
            </p>
            <dl className="mt-4 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between">
                <dt className="text-slate-400">Bolsa</dt>
                <dd className="font-medium">{edital.tipoBolsa}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Bolsas</dt>
                <dd className="font-medium">{edital.totalCotas}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Inscrições até</dt>
                <dd className="font-medium">
                  {new Date(edital.dataFimInscricoes).toLocaleDateString('pt-BR')}
                </dd>
              </div>
            </dl>
            <Link
              to={`/editais/${edital.id}`}
              className="mt-5 rounded-md border border-brand-600 py-2 text-center text-sm font-medium text-brand-600 transition hover:bg-brand-50"
            >
              Ver Detalhes
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
