import { z } from 'zod';

import type { Usuario } from '../../auth/domain/auth.types';
import type { Anexo } from '../domain/inscricoes.types';
import type { InscricaoView } from '../inscricoes.service';

export const criarInscricaoSchema = z
  .object({
    editalId: z.string().trim().min(1, 'editalId é obrigatório'),
  })
  .strict();

/** Auto-save: todos os campos opcionais; limites evitam payloads abusivos. */
export const rascunhoSchema = z
  .object({
    titulo: z.string().max(200).optional(),
    subareaCode: z.string().trim().max(10).optional(),
    palavrasChave: z.string().max(200).optional(),
    resumo: z.string().max(3000).optional(),
    objetivos: z.string().max(3000).optional(),
    metodologia: z.string().max(5000).optional(),
    orientadorId: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

export const anexoTipoSchema = z.enum(['PLANO_TRABALHO', 'LATTES']);

export const vinculoSchema = z
  .object({
    decisao: z.enum(['CONFIRMAR', 'RECUSAR']),
    comentario: z.string().trim().max(1000).optional(),
  })
  .strict();

function toPessoa(usuario: Usuario | undefined) {
  return usuario
    ? { id: usuario.id, nome: usuario.nome, email: usuario.email, departamento: usuario.departamento }
    : null;
}

export function toAnexoResponse(anexo: Anexo) {
  return {
    id: anexo.id,
    tipo: anexo.tipo,
    nome: anexo.nome,
    tamanho: anexo.tamanho,
    enviadoEm: anexo.enviadoEm.toISOString(),
  };
}

/** Contrato da inscrição para a SPA. `pendencias` só é enviado no detalhe. */
export function toInscricaoResponse(view: InscricaoView, extras: { pendencias?: string[] } = {}) {
  const { inscricao, edital } = view;
  return {
    id: inscricao.id,
    protocolo: inscricao.protocolo,
    status: inscricao.status,
    vinculoStatus: inscricao.vinculoStatus,
    vinculoComentario: inscricao.vinculoComentario,
    titulo: inscricao.titulo,
    subareaCode: inscricao.subareaCode,
    subareaNome: inscricao.subareaNome,
    palavrasChave: inscricao.palavrasChave,
    resumo: inscricao.resumo,
    objetivos: inscricao.objetivos,
    metodologia: inscricao.metodologia,
    edital: edital
      ? {
          id: edital.id,
          numero: edital.numero,
          titulo: edital.titulo,
          tipoBolsa: edital.tipoBolsa,
          dataFimInscricoes: edital.dataFimInscricoes.toISOString(),
          notaCorte: edital.notaCorte,
        }
      : null,
    discente: toPessoa(view.discente),
    orientador: toPessoa(view.orientador),
    anexos: inscricao.anexos.map(toAnexoResponse),
    homologacaoJustificativa: inscricao.homologacaoJustificativa,
    submetidaEm: inscricao.submetidaEm?.toISOString() ?? null,
    homologadaEm: inscricao.homologadaEm?.toISOString() ?? null,
    criadoEm: inscricao.criadoEm.toISOString(),
    atualizadoEm: inscricao.atualizadoEm.toISOString(),
    ...(extras.pendencias ? { pendencias: extras.pendencias } : {}),
  };
}

export type InscricaoResponse = ReturnType<typeof toInscricaoResponse>;
