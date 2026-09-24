import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../services/api';
import type { Edital } from '../types';

/** Detalhe público de um edital publicado — acessível sem login. */
export function EditalPublicoPage() {
  const { id } = useParams<{ id: string }>();
  const [edital, setEdital] = useState<Edital | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCarregando(true);
    api
      .get<{ data: Edital[] }>('/api/publico/editais')
      .then((res) => {
        const found = res.data.find((e) => e.id === id) ?? null;
        if (!cancelled) setEdital(found);
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
  }, [id]);

  if (carregando) return <p className="text-slate-500">Carregando…</p>;

  if (erro) {
    return (
      <div>
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
        <Link to="/editais" className="mt-4 inline-block font-medium text-brand-600 hover:underline">
          ← Voltar para a vitrine
        </Link>
      </div>
    );
  }

  if (!edital) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-lg font-medium text-slate-700">
          Edital não encontrado ou não está mais aberto.
        </p>
        <Link to="/editais" className="mt-4 inline-block font-medium text-brand-600 hover:underline">
          ← Voltar para a vitrine
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/editais" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar para a vitrine
      </Link>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            INSCRIÇÕES ABERTAS
          </span>
          <span className="text-sm text-slate-400">{edital.numero}</span>
        </div>

        <h1 className="mt-3 text-3xl font-bold text-brand-900">{edital.titulo}</h1>
        <p className="mt-2 text-slate-600">{edital.descricao || 'Sem descrição.'}</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-5 text-sm">
          <div>
            <dt className="text-slate-400">Tipo de bolsa</dt>
            <dd className="font-semibold">{edital.tipoBolsa}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Total de bolsas</dt>
            <dd className="font-semibold">{edital.totalCotas}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Inscrições começam em</dt>
            <dd className="font-semibold">
              {new Date(edital.dataInicioInscricoes).toLocaleDateString('pt-BR')}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Inscrições terminam em</dt>
            <dd className="font-semibold">
              {new Date(edital.dataFimInscricoes).toLocaleDateString('pt-BR')}
            </dd>
          </div>
        </dl>

        <h2 className="mt-6 text-lg font-bold text-slate-800">Cotas por subárea CNPq</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="py-2">Subárea</th>
              <th className="py-2 text-right">Bolsas</th>
            </tr>
          </thead>
          <tbody>
            {edital.cotas.map((cota) => (
              <tr key={cota.subareaCode} className="border-b border-slate-100">
                <td className="py-2">
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {cota.subareaCode}
                  </span>
                  {cota.subareaNome}
                </td>
                <td className="py-2 text-right font-semibold">{cota.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
