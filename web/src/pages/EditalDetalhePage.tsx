import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../services/api';
import type { Edital } from '../types';

/** Detalhe administrativo do edital (gestor) — ações conforme o ciclo de vida. */
export function EditalDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [edital, setEdital] = useState<Edital | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acaoEmCurso, setAcaoEmCurso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<Edital>(`/api/editais/${id}`);
      setEdital(res);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar edital.');
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function transicionar(acao: 'publicar' | 'encerrar') {
    if (!id) return;
    setAcaoEmCurso(acao);
    setErro(null);
    try {
      await api.post<Edital>(`/api/editais/${id}/transicoes`, { acao });
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha na transição.');
    } finally {
      setAcaoEmCurso(null);
    }
  }

  if (!edital) {
    return (
      <div>
        {erro && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}
        <p className="text-slate-500">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/gestor/editais" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar ao painel
      </Link>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">{edital.numero} · {edital.tipoBolsa}</p>
            <h1 className="mt-1 text-2xl font-bold text-brand-900">{edital.titulo}</h1>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {edital.status}
          </span>
        </div>

        {erro && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <p className="mt-4 text-slate-600">{edital.descricao || 'Sem descrição.'}</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-400">Total de bolsas</dt>
            <dd className="font-semibold">{edital.totalCotas}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Início</dt>
            <dd className="font-semibold">
              {new Date(edital.dataInicioInscricoes).toLocaleDateString('pt-BR')}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Fim</dt>
            <dd className="font-semibold">
              {new Date(edital.dataFimInscricoes).toLocaleDateString('pt-BR')}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Publicado em</dt>
            <dd className="font-semibold">
              {edital.publicadoEm ? new Date(edital.publicadoEm).toLocaleDateString('pt-BR') : '—'}
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

        <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          {edital.status === 'RASCUNHO' && (
            <>
              <Link
                to={`/gestor/editais/${edital.id}/editar`}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Editar
              </Link>
              <button
                type="button"
                onClick={() => void transicionar('publicar')}
                disabled={acaoEmCurso === 'publicar'}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {acaoEmCurso === 'publicar' ? 'Publicando…' : 'Publicar'}
              </button>
            </>
          )}
          {edital.status === 'PUBLICADO' && (
            <button
              type="button"
              onClick={() => void transicionar('encerrar')}
              disabled={acaoEmCurso === 'encerrar'}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {acaoEmCurso === 'encerrar' ? 'Encerrando…' : 'Encerrar inscrições'}
            </button>
          )}
          {edital.status === 'PUBLICADO' && (
            <Link
              to={`/editais/${edital.id}`}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Ver na vitrine pública
            </Link>
          )}
          <Link
            to="/gestor/editais"
            className="ml-auto rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
