import type { Router } from 'express';

import { asyncHandler } from '@shared/http/http.middleware';
import { NotFoundError } from '@shared/errors/domain.errors';
import type { Clock } from '@shared/time/clock';

import type { UsuariosRepository } from '../auth/repositories/usuarios.repository';
import { EditaisService } from '../editais/editais.service';
import { toPublicEditalResponse } from '../editais/dto/editais.dto';
import type { Edital } from '../editais/domain/editais.types';
import type { InscricoesRepository } from '../inscricoes/repositories/inscricoes.repository';

export interface PublicoDeps {
  editaisService: EditaisService;
  inscricoes: InscricoesRepository;
  usuarios: UsuariosRepository;
  clock: Clock;
}

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Rotas públicas (sem autenticação):
 *   GET /api/publico/editais       → editais PUBLICADO com prazo vigente + bolsas alocadas (RF08/RN04)
 *   GET /api/publico/editais/:id   → detalhe de edital publicado ou encerrado
 *   GET /api/publico/pesquisas     → vitrine de pesquisas APROVADAS (RF25/RN10), sem dados pessoais sensíveis
 */
export function registerPublicoRoutes(router: Router, deps: PublicoDeps): void {
  const { editaisService, inscricoes, usuarios, clock } = deps;

  /** Quantas bolsas de cada subárea já foram homologadas no edital. */
  async function comAlocacao(edital: Edital) {
    const aprovadas = await inscricoes.list({ editalId: edital.id, status: ['APROVADA'] });
    const porSubarea = new Map<string, number>();
    for (const i of aprovadas) porSubarea.set(i.subareaCode, (porSubarea.get(i.subareaCode) ?? 0) + 1);
    const base = toPublicEditalResponse(edital);
    return {
      ...base,
      bolsasAlocadas: aprovadas.length,
      cotas: base.cotas.map((c) => ({ ...c, alocadas: porSubarea.get(c.subareaCode) ?? 0 })),
    };
  }

  router.get(
    '/api/publico/editais',
    asyncHandler(async (_req, res) => {
      await editaisService.syncAutomaticClosure();
      const publicados = await editaisService.list('PUBLICADO');
      const now = clock.now().getTime();
      const vigentes = publicados.filter((edital) => edital.dataFimInscricoes.getTime() >= now);
      res.json({
        data: await Promise.all(vigentes.map(comAlocacao)),
        total: vigentes.length,
        geradoEm: clock.now().toISOString(),
      });
    }),
  );

  router.get(
    '/api/publico/editais/:id',
    asyncHandler(async (req, res) => {
      await editaisService.syncAutomaticClosure();
      const edital = await editaisService.getById(req.params['id'] as string);
      if (edital.status === 'RASCUNHO') {
        throw new NotFoundError(`Edital ${edital.id} não encontrado.`);
      }
      res.json(await comAlocacao(edital));
    }),
  );

  router.get(
    '/api/publico/pesquisas',
    asyncHandler(async (req, res) => {
      const editalId = queryString(req.query['editalId']);
      const subareaCode = queryString(req.query['subareaCode']);
      const ano = Number.parseInt(queryString(req.query['ano']) ?? '', 10);
      const busca = queryString(req.query['q'])?.toLowerCase();

      const aprovadas = (await inscricoes.list({ status: ['APROVADA'], editalId, subareaCode })).filter(
        (i) => !Number.isFinite(ano) || i.homologadaEm?.getUTCFullYear() === ano,
      );
      const pessoas = await usuarios.findManyByIds([
        ...new Set(aprovadas.flatMap((i) => [i.discenteId, ...(i.orientadorId ? [i.orientadorId] : [])])),
      ]);
      const nomeDe = new Map(pessoas.map((p) => [p.id, p] as const));
      const editais = new Map<string, Edital>();
      for (const id of new Set(aprovadas.map((i) => i.editalId))) {
        const edital = await editaisService.getById(id).catch(() => undefined);
        if (edital) editais.set(id, edital);
      }

      const data = aprovadas
        .map((i) => {
          const orientador = i.orientadorId ? nomeDe.get(i.orientadorId) : undefined;
          const edital = editais.get(i.editalId);
          // Apenas campos públicos: sem e-mail, matrícula ou anexos.
          return {
            id: i.id,
            protocolo: i.protocolo,
            titulo: i.titulo,
            resumo: i.resumo,
            palavrasChave: i.palavrasChave,
            subareaCode: i.subareaCode,
            subareaNome: i.subareaNome,
            ano: i.homologadaEm?.getUTCFullYear() ?? null,
            edital: edital ? { id: edital.id, numero: edital.numero, tipoBolsa: edital.tipoBolsa } : null,
            bolsista: nomeDe.get(i.discenteId)?.nome ?? null,
            orientador: orientador ? { nome: orientador.nome, departamento: orientador.departamento } : null,
          };
        })
        .filter(
          (p) =>
            !busca ||
            [p.titulo, p.resumo, p.palavrasChave, p.orientador?.nome ?? '', p.bolsista ?? '']
              .join(' ')
              .toLowerCase()
              .includes(busca),
        );

      res.json({ data, total: data.length });
    }),
  );
}
