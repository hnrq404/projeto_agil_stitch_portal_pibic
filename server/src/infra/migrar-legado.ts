import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { LEGACY_AVALIADOR_ROLE } from '../shared/auth/auth.types';
import { competenciaDe } from '../modules/projetos/domain/projetos.rules';

/**
 * Converte dados gravados pelo fluxo antigo (aluno escrevia a proposta e
 * indicava o orientador; avaliador era um papel à parte; relatório parcial em
 * PDF) para o fluxo atual. Idempotente: roda no começo de todo seed.
 */
export async function migrarLegado(prisma: PrismaClient): Promise<string[]> {
  const log: string[] = [];

  // 1. Avaliador e docente foram unificados.
  const avaliadores = await prisma.usuario.updateMany({
    where: { role: LEGACY_AVALIADOR_ROLE },
    data: { role: 'DOCENTE' },
  });
  if (avaliadores.count > 0) log.push(`${avaliadores.count} conta(s) de avaliador passaram a docente.`);

  // 2. Propostas do aluno: no fluxo novo, rascunho nunca tem aluno e SUBMETIDA não existe.
  const antigas = await prisma.inscricao.findMany({
    where: { OR: [{ status: 'SUBMETIDA' }, { status: 'RASCUNHO', discenteId: { not: null } }] },
  });
  for (const proposta of antigas) {
    if (!proposta.orientadorId) {
      // Rascunho de aluno sem professor: não há dono possível no fluxo novo.
      await prisma.inscricao.delete({ where: { id: proposta.id } });
      log.push(`Rascunho sem orientador removido: "${proposta.titulo || proposta.id}".`);
      continue;
    }
    // O professor indicado vira o dono; o aluno fica como candidato já selecionado.
    const status = proposta.status === 'SUBMETIDA' ? 'DIVULGADA' : 'RASCUNHO';
    await prisma.inscricao.update({
      where: { id: proposta.id },
      data: { status, divulgadaEm: status === 'DIVULGADA' ? (proposta.submetidaEm ?? proposta.atualizadoEm) : null, submetidaEm: null },
    });
    if (proposta.discenteId) {
      await prisma.candidatura.upsert({
        where: { inscricaoId_discenteId: { inscricaoId: proposta.id, discenteId: proposta.discenteId } },
        update: {},
        create: {
          id: randomUUID(),
          inscricaoId: proposta.id,
          discenteId: proposta.discenteId,
          mensagem: 'Candidatura migrada do fluxo anterior, em que o aluno indicava o orientador.',
          status: 'SELECIONADA',
          criadoEm: proposta.criadoEm,
          respondidaEm: proposta.atualizadoEm,
        },
      });
    }
    log.push(`Proposta "${proposta.titulo}" agora pertence ao professor (${status}).`);
  }

  // 3. Relatório parcial (PDF) vira o relatório mensal do mês em que foi enviado.
  const parciais = await prisma.relatorio.findMany({ where: { tipo: 'PARCIAL' } });
  for (const r of parciais) {
    await prisma.relatorio.update({
      where: { id: r.id },
      data: {
        tipo: 'MENSAL',
        competencia: competenciaDe(r.enviadoEm),
        descricao: r.descricao || 'Relatório parcial enviado em PDF no formato anterior do portal.',
      },
    });
  }
  if (parciais.length > 0) log.push(`${parciais.length} relatório(s) parcial(is) convertido(s) em mensal.`);

  return log;
}
