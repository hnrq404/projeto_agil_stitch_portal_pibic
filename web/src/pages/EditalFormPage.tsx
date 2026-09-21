import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../services/api';
import type { BolsaTipo, CnpqArea, Edital, EditalStatus } from '../types';

interface CotaForm {
  subareaCode: string;
  quantidade: number | string;
}

const BOLSAS: BolsaTipo[] = ['PIBIC', 'PIBITI', 'PIBIC_AF', 'VOLUNTARIO'];

function toInputValue(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join('/');
}

function toIsoDate(value: string, endOfDay: boolean): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new Error('Informe a data no formato DD/MM/AAAA.');

  const [, day, month, year] = match;
  const date = new Date(
    `${year}-${month}-${day}T${endOfDay ? '23:59:59' : '12:00:00'}.000Z`,
  );
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error('Informe uma data válida.');
  }
  return date.toISOString();
}

/** Formulário criar/editar edital — com validação em tempo real da soma de cotas. */
export function EditalFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [numero, setNumero] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoBolsa, setTipoBolsa] = useState<BolsaTipo>('PIBIC');
  const [totalCotas, setTotalCotas] = useState<number | string>(5);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [cotas, setCotas] = useState<CotaForm[]>([{ subareaCode: '1.03', quantidade: 1 }]);

  const [areas, setAreas] = useState<CnpqArea[]>([]);
  const [statusAtual, setStatusAtual] = useState<EditalStatus>('RASCUNHO');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(editing);

  useEffect(() => {
    api.get<{ data: CnpqArea[] }>('/api/cnpq/areas').then((res) => setAreas(res.data)).catch(() => {});
  }, []);

  // Carrega o edital em modo edição.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .get<Edital>(`/api/editais/${id}`)
      .then((edital) => {
        if (cancelled) return;
        setNumero(edital.numero);
        setTitulo(edital.titulo);
        setDescricao(edital.descricao);
        setTipoBolsa(edital.tipoBolsa);
        setTotalCotas(edital.totalCotas);
        setDataInicio(toInputValue(edital.dataInicioInscricoes));
        setDataFim(toInputValue(edital.dataFimInscricoes));
        setCotas(edital.cotas.map((c) => ({ subareaCode: c.subareaCode, quantidade: c.quantidade })));
        setStatusAtual(edital.status);
      })
      .catch((err: Error) => setErro(err.message))
      .finally(() => {
        if (!cancelled) setCarregando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── Validação em tempo real: soma das cotas × total ────────────────────
  const total = Number(totalCotas) || 0;
  const somaCotas = useMemo(
    () => cotas.reduce((acc, c) => acc + (Number(c.quantidade) || 0), 0),
    [cotas],
  );
  const somaExcede = somaCotas > total;
  const temDuplicadas = useMemo(
    () => new Set(cotas.map((c) => c.subareaCode)).size !== cotas.length,
    [cotas],
  );

  function updateCota(index: number, patch: Partial<CotaForm>) {
    setCotas((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function handleSubmit(publicarDepois: boolean) {
    setErro(null);
    setEnviando(true);

    try {
      const payload = {
        numero: numero.trim(),
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        tipoBolsa,
        totalCotas: Number(totalCotas),
        cotas: cotas
          .filter((c) => c.subareaCode)
          .map((c) => ({ subareaCode: c.subareaCode, quantidade: Number(c.quantidade) })),
        dataInicioInscricoes: toIsoDate(dataInicio, false),
        dataFimInscricoes: toIsoDate(dataFim, true),
      };

      if (editing) {
        await api.patch<Edital>(`/api/editais/${id}`, payload);
        if (publicarDepois) {
          await api.post<Edital>(`/api/editais/${id}/publicar`);
        }
        navigate(`/gestor/editais/${id}`);
      } else {
        const created = await api.post<Edital>('/api/editais', payload);
        if (publicarDepois) {
          await api.post<Edital>(`/api/editais/${created.id}/publicar`);
          navigate('/gestor/editais');
        } else {
          navigate(`/gestor/editais/${created.id}`);
        }
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar o edital.');
      setEnviando(false);
    }
  }

  if (carregando) return <p className="text-slate-500">Carregando edital…</p>;

  if (editing && statusAtual !== 'RASCUNHO') {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-medium text-slate-700">
          Este edital está <strong>{statusAtual}</strong> e não pode mais ser editado
          (apenas RASCUNHO é editável).
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            to={`/gestor/editais/${id}`}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Ver Detalhes
          </Link>
          <Link
            to="/gestor/editais"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/gestor/editais" className="text-sm font-medium text-brand-600 hover:underline">
        ← Voltar ao painel
      </Link>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-900">
          {editing ? `Editar Edital ${numero}` : 'Criar Novo Edital'}
        </h1>

        {erro && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        )}

        <form
          className="mt-6 space-y-5"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void handleSubmit(false);
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="numero" className="block text-sm font-medium text-slate-700">
                Número do edital
              </label>
              <input
                id="numero"
                required
                minLength={3}
                placeholder="06/2026"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
            <div>
              <label htmlFor="tipoBolsa" className="block text-sm font-medium text-slate-700">
                Tipo de bolsa
              </label>
              <select
                id="tipoBolsa"
                value={tipoBolsa}
                onChange={(e) => setTipoBolsa(e.target.value as BolsaTipo)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              >
                {BOLSAS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="titulo" className="block text-sm font-medium text-slate-700">
              Título
            </label>
            <input
              id="titulo"
              required
              minLength={5}
              placeholder="Edital PIBIC 2026/2027"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-slate-700">
              Descrição
            </label>
            <textarea
              id="descricao"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="totalCotas" className="block text-sm font-medium text-slate-700">
                Total de bolsas
              </label>
              <input
                id="totalCotas"
                type="number"
                required
                min={1}
                value={totalCotas}
                onChange={(e) => setTotalCotas(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
            <div>
              <label htmlFor="dataInicio" className="block text-sm font-medium text-slate-700">
                Início das inscrições
              </label>
              <input
                id="dataInicio"
                type="text"
                inputMode="numeric"
                required
                placeholder="DD/MM/AAAA"
                maxLength={10}
                value={dataInicio}
                onChange={(e) => setDataInicio(formatDateInput(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
            <div>
              <label htmlFor="dataFim" className="block text-sm font-medium text-slate-700">
                Fim das inscrições
              </label>
              <input
                id="dataFim"
                type="text"
                inputMode="numeric"
                required
                placeholder="DD/MM/AAAA"
                maxLength={10}
                value={dataFim}
                onChange={(e) => setDataFim(formatDateInput(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              />
            </div>
          </div>

          {/* ── Cotas por subárea CNPq ──────────────────────────────────── */}
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-2 text-sm font-semibold text-slate-700">
              Cotas por subárea CNPq
            </legend>

            <div className="space-y-3">
              {cotas.map((cota, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    aria-label="Subárea CNPq"
                    value={cota.subareaCode}
                    onChange={(e) => updateCota(index, { subareaCode: e.target.value })}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                  >
                    <option value="">Selecione a subárea…</option>
                    {areas.map((area) => (
                      <option key={area.code} value={area.code}>
                        {area.code} — {area.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    aria-label="Quantidade de bolsas"
                    value={cota.quantidade}
                    onChange={(e) => updateCota(index, { quantidade: e.target.value })}
                    className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
                  />
                  <button
                    type="button"
                    aria-label="Remover cota"
                    onClick={() => setCotas((prev) => prev.filter((_, i) => i !== index))}
                    className="rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCotas((prev) => [...prev, { subareaCode: '', quantidade: 1 }])}
              className="mt-3 rounded-md border border-dashed border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              + Adicionar cota por subárea
            </button>

            {/* Validação em tempo real — soma × total (RN de consistência) */}
            <div
              className={`mt-4 rounded-md px-3 py-2 text-sm ${
                somaExcede
                  ? 'bg-red-50 font-medium text-red-700'
                  : somaCotas === total
                    ? 'bg-green-50 text-green-700'
                    : 'bg-slate-50 text-slate-600'
              }`}
              data-testid="soma-cotas"
            >
              {somaExcede
                ? `⚠ A soma das cotas (${somaCotas}) EXCEDE o total de bolsas (${total}). Ajuste antes de salvar.`
                : `Soma distribuída: ${somaCotas} de ${total} bolsas ${
                    somaCotas === total ? '(distribuição completa)' : `(restam ${total - somaCotas})`
                  }`}
            </div>
            {temDuplicadas && (
              <p className="mt-2 text-sm text-red-600">
                ⚠ Há subáreas repetidas — cada subárea pode aparecer uma única vez.
              </p>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <Link
              to="/gestor/editais"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={enviando || somaExcede || temDuplicadas}
              className="rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50"
            >
              {enviando ? 'Salvando…' : 'Salvar Rascunho'}
            </button>
            <button
              type="button"
              disabled={enviando || somaExcede || temDuplicadas}
              onClick={() => void handleSubmit(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {enviando ? 'Publicando…' : 'Salvar e Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
