import type { Clock } from '@shared/time/clock';

import type { AvaliacoesRepository } from '../avaliacoes/repositories/avaliacoes.repository';
import type { EditaisRepository } from '../editais/repositories/editais.repository';
import type { InscricaoStatus } from '../inscricoes/domain/inscricoes.types';
import type { InscricoesRepository } from '../inscricoes/repositories/inscricoes.repository';
import { prazoRelatorio, situacaoRelatorio } from '../projetos/domain/projetos.rules';
import { RELATORIO_TIPOS } from '../projetos/domain/projetos.types';
import type { RelatoriosRepository } from '../projetos/repositories/relatorios.repository';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface CotaSubareaMetrica {
  subareaCode: string;
  subareaNome: string;
  cotas: number;
  submetidas: number;
  aprovadas: number;
}

export interface Alerta {
  nivel: 'info' | 'atencao';
  mensagem: string;
}

export interface PainelGestor {
  editais: { rascunho: number; publicados: number; encerrados: number };
  inscricoes: { total: number; porStatus: Record<InscricaoStatus, number> };
  bolsas: { total: number; alocadas: number };
  avaliacoes: { pendentes: number; concluidas: number; tempoMedioDias: number | null };
  relatorios: { emAnalise: number; atrasados: number };
  cotasPorSubarea: CotaSubareaMetrica[];
  alertas: Alerta[];
}

/**
 * Painel do gestor (S5/RF23–RF24): agregações calculadas sob demanda a partir
 * dos repositórios. Volume do PIBIC (centenas de propostas) dispensa cache.
 */
export class DashboardService {
  constructor(
    private readonly editais: EditaisRepository,
    private readonly inscricoes: InscricoesRepository,
    private readonly avaliacoes: AvaliacoesRepository,
    private readonly relatorios: RelatoriosRepository,
    private readonly clock: Clock,
  ) {}

  async painelGestor(editalId?: string): Promise<PainelGestor> {
    const todosEditais = await this.editais.list();
    const editais = editalId ? todosEditais.filter((e) => e.id === editalId) : todosEditais;
    const inscricoes = (await this.inscricoes.list(editalId ? { editalId } : {})).filter(
      (i) => i.status !== 'RASCUNHO',
    );
    const ids = new Set(inscricoes.map((i) => i.id));
    const avaliacoes = (await this.avaliacoes.list()).filter((a) => ids.has(a.inscricaoId));
    const relatorios = (await this.relatorios.list()).filter((r) => ids.has(r.inscricaoId));
    const agora = this.clock.now();

    const porStatus: Record<InscricaoStatus, number> = {
      RASCUNHO: 0,
      SUBMETIDA: 0,
      EM_AVALIACAO: 0,
      AVALIADA: 0,
      APROVADA: 0,
      RECUSADA: 0,
    };
    for (const i of inscricoes) porStatus[i.status] += 1;

    const concluidas = avaliacoes.filter((a) => a.status === 'CONCLUIDA' && a.concluidaEm);
    const tempoMedioDias =
      concluidas.length === 0
        ? null
        : Math.round(
            (concluidas.reduce((acc, a) => acc + (a.concluidaEm!.getTime() - a.atribuidaEm.getTime()), 0) /
              concluidas.length /
              DIA_MS) *
              10,
          ) / 10;

    // Cotas por subárea somando os editais que já abriram inscrições.
    const vigentes = editais.filter((e) => e.status !== 'RASCUNHO');
    const porSubarea = new Map<string, CotaSubareaMetrica>();
    for (const edital of vigentes) {
      for (const cota of edital.cotas) {
        const atual = porSubarea.get(cota.subareaCode) ?? {
          subareaCode: cota.subareaCode,
          subareaNome: cota.subareaNome,
          cotas: 0,
          submetidas: 0,
          aprovadas: 0,
        };
        atual.cotas += cota.quantidade;
        porSubarea.set(cota.subareaCode, atual);
      }
    }
    for (const i of inscricoes) {
      const metrica = porSubarea.get(i.subareaCode);
      if (!metrica) continue;
      metrica.submetidas += 1;
      if (i.status === 'APROVADA') metrica.aprovadas += 1;
    }

    let emAnalise = 0;
    let atrasados = 0;
    for (const projeto of inscricoes.filter((i) => i.status === 'APROVADA')) {
      const doProjeto = relatorios.filter((r) => r.inscricaoId === projeto.id);
      for (const tipo of RELATORIO_TIPOS) {
        const prazo = prazoRelatorio(projeto.homologadaEm ?? projeto.atualizadoEm, tipo);
        const situacao = situacaoRelatorio(doProjeto, tipo, prazo, agora);
        if (situacao === 'EM_ANALISE') emAnalise += 1;
        if (situacao === 'ATRASADO') atrasados += 1;
      }
    }

    const cotasPorSubarea = [...porSubarea.values()].sort((a, b) => b.cotas - a.cotas);

    return {
      editais: {
        rascunho: editais.filter((e) => e.status === 'RASCUNHO').length,
        publicados: editais.filter((e) => e.status === 'PUBLICADO').length,
        encerrados: editais.filter((e) => e.status === 'ENCERRADO').length,
      },
      inscricoes: { total: inscricoes.length, porStatus },
      bolsas: { total: vigentes.reduce((acc, e) => acc + e.totalCotas, 0), alocadas: porStatus.APROVADA },
      avaliacoes: {
        pendentes: avaliacoes.filter((a) => a.status === 'PENDENTE').length,
        concluidas: concluidas.length,
        tempoMedioDias,
      },
      relatorios: { emAnalise, atrasados },
      cotasPorSubarea,
      alertas: this.alertas(cotasPorSubarea, porStatus, atrasados),
    };
  }

  private alertas(
    cotas: readonly CotaSubareaMetrica[],
    porStatus: Record<InscricaoStatus, number>,
    relatoriosAtrasados: number,
  ): Alerta[] {
    const alertas: Alerta[] = [];
    for (const c of cotas) {
      if (c.submetidas < c.cotas) {
        alertas.push({
          nivel: 'atencao',
          mensagem: `${c.subareaNome}: ${c.submetidas} proposta(s) para ${c.cotas} cota(s). Cotas podem ficar sem preencher.`,
        });
      }
    }
    if (porStatus.SUBMETIDA > 0) {
      alertas.push({
        nivel: 'info',
        mensagem: `${porStatus.SUBMETIDA} proposta(s) aguardando distribuição na Central de Triagem.`,
      });
    }
    if (porStatus.AVALIADA > 0) {
      alertas.push({
        nivel: 'info',
        mensagem: `${porStatus.AVALIADA} proposta(s) avaliada(s) aguardando homologação.`,
      });
    }
    if (relatoriosAtrasados > 0) {
      alertas.push({
        nivel: 'atencao',
        mensagem: `${relatoriosAtrasados} relatório(s) com prazo vencido.`,
      });
    }
    return alertas;
  }
}
