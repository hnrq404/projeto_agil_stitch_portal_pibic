/**
 * Contrato da API (espelha os DTOs de server/src/modules/* /dto).
 * Mudou o backend? Ajuste aqui: o TypeScript aponta cada tela afetada.
 */

export type UserRole = 'DISCENTE' | 'DOCENTE' | 'AVALIADOR' | 'GESTOR' | 'ADMIN' | 'USUARIO';
export type RegistroRole = 'DISCENTE' | 'DOCENTE' | 'USUARIO';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  departamento: string;
  matricula: string | null;
  criadoEm: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export interface ListResponse<T> {
  data: T[];
  total: number;
}

// ── Editais ────────────────────────────────────────────────────────────────

export type EditalStatus = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO';
export type BolsaTipo = 'PIBIC' | 'PIBITI' | 'PIBIC_AF' | 'VOLUNTARIO';

export interface CotaSubarea {
  subareaCode: string;
  subareaNome: string;
  quantidade: number;
}

export interface Edital {
  id: string;
  numero: string;
  titulo: string;
  descricao: string;
  status: EditalStatus;
  tipoBolsa: BolsaTipo;
  totalCotas: number;
  cotas: CotaSubarea[];
  notaCorte: number;
  dataInicioInscricoes: string;
  dataFimInscricoes: string;
  publicadoEm: string | null;
  encerradoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EditalPublico {
  id: string;
  numero: string;
  titulo: string;
  descricao: string;
  status: EditalStatus;
  tipoBolsa: BolsaTipo;
  totalCotas: number;
  bolsasAlocadas: number;
  cotas: (CotaSubarea & { alocadas: number })[];
  dataInicioInscricoes: string;
  dataFimInscricoes: string;
}

export interface EditalInput {
  numero: string;
  titulo: string;
  descricao: string;
  tipoBolsa: BolsaTipo;
  totalCotas: number;
  notaCorte: number;
  cotas: { subareaCode: string; quantidade: number }[];
  dataInicioInscricoes: string;
  dataFimInscricoes: string;
}

export interface CnpqArea {
  code: string;
  name: string;
}

// ── Inscrições ─────────────────────────────────────────────────────────────

export type InscricaoStatus =
  | 'RASCUNHO'
  | 'SUBMETIDA'
  | 'EM_AVALIACAO'
  | 'AVALIADA'
  | 'APROVADA'
  | 'RECUSADA';
export type VinculoStatus = 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO';
export type AnexoTipo = 'PLANO_TRABALHO' | 'LATTES';

export interface Pessoa {
  id: string;
  nome: string;
  email: string;
  departamento: string;
}

export interface Anexo {
  id: string;
  tipo: AnexoTipo;
  nome: string;
  tamanho: number;
  enviadoEm: string;
}

export interface Inscricao {
  id: string;
  protocolo: string | null;
  status: InscricaoStatus;
  vinculoStatus: VinculoStatus | null;
  vinculoComentario: string | null;
  titulo: string;
  subareaCode: string;
  subareaNome: string;
  palavrasChave: string;
  resumo: string;
  objetivos: string;
  metodologia: string;
  edital: {
    id: string;
    numero: string;
    titulo: string;
    tipoBolsa: BolsaTipo;
    dataFimInscricoes: string;
    notaCorte: number;
  } | null;
  discente: Pessoa | null;
  orientador: Pessoa | null;
  anexos: Anexo[];
  homologacaoJustificativa: string | null;
  submetidaEm: string | null;
  homologadaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Presente no detalhe do rascunho do próprio discente. */
  pendencias?: string[];
}

export interface RascunhoInput {
  titulo?: string;
  subareaCode?: string;
  palavrasChave?: string;
  resumo?: string;
  objetivos?: string;
  metodologia?: string;
  orientadorId?: string | null;
}

export interface Docente {
  id: string;
  nome: string;
  departamento: string;
}

// ── Avaliação e triagem ────────────────────────────────────────────────────

export type CriterioId = 'MERITO' | 'VIABILIDADE' | 'ADEQUACAO' | 'FORMACAO';

export interface Criterio {
  id: CriterioId;
  nome: string;
  descricao: string;
}

export interface NotaCriterio {
  criterio: CriterioId;
  nota: number;
}

export interface Avaliacao {
  id: string;
  inscricaoId: string;
  avaliador: { id: string; nome: string; departamento: string };
  status: 'PENDENTE' | 'CONCLUIDA';
  notas: NotaCriterio[];
  notaFinal: number | null;
  parecer: string;
  atribuidaEm: string;
  concluidaEm: string | null;
}

export interface AvaliacaoComInscricao extends Avaliacao {
  inscricao: Inscricao;
}

export interface AvaliacaoDetalhe extends AvaliacaoComInscricao {
  criterios: Criterio[];
}

export interface Consolidado {
  total: number;
  concluidas: number;
  media: number | null;
  menor: number | null;
  maior: number | null;
  divergente: boolean;
}

export interface ItemTriagem {
  inscricao: Inscricao;
  avaliacoes: Avaliacao[];
  consolidado: Consolidado;
}

export interface AvaliadorResumo {
  id: string;
  nome: string;
  departamento: string;
  pendentes: number;
}

// ── Projetos e relatórios ──────────────────────────────────────────────────

export type RelatorioTipo = 'PARCIAL' | 'FINAL';
export type RelatorioStatus = 'ENVIADO' | 'APROVADO' | 'DEVOLVIDO';
export type SituacaoRelatorio = 'AGUARDANDO_ENVIO' | 'ATRASADO' | 'EM_ANALISE' | 'DEVOLVIDO' | 'APROVADO';

export interface Relatorio {
  id: string;
  tipo: RelatorioTipo;
  versao: number;
  status: RelatorioStatus;
  nome: string;
  tamanho: number;
  comentarioOrientador: string | null;
  enviadoEm: string;
  avaliadoEm: string | null;
}

export interface ProjetoDetalhe {
  projeto: Inscricao;
  relatorios: Relatorio[];
  acompanhamento: { tipo: RelatorioTipo; prazo: string; situacao: SituacaoRelatorio }[];
  timeline: { data: string; titulo: string; descricao: string }[];
}

// ── Painel, notificações e vitrine ─────────────────────────────────────────

export interface PainelGestor {
  editais: { rascunho: number; publicados: number; encerrados: number };
  inscricoes: { total: number; porStatus: Record<InscricaoStatus, number> };
  bolsas: { total: number; alocadas: number };
  avaliacoes: { pendentes: number; concluidas: number; tempoMedioDias: number | null };
  relatorios: { emAnalise: number; atrasados: number };
  cotasPorSubarea: {
    subareaCode: string;
    subareaNome: string;
    cotas: number;
    submetidas: number;
    aprovadas: number;
  }[];
  alertas: { nivel: 'info' | 'atencao'; mensagem: string }[];
}

export type NotificacaoTipo =
  | 'EDITAL_PUBLICADO'
  | 'EDITAL_ENCERRADO'
  | 'VINCULO_SOLICITADO'
  | 'VINCULO_RESPONDIDO'
  | 'AVALIACAO_ATRIBUIDA'
  | 'INSCRICAO_RESULTADO'
  | 'RELATORIO_ENVIADO'
  | 'RELATORIO_AVALIADO';

export interface Notificacao {
  id: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  referenceId: string | null;
  lida: boolean;
  criadoEm: string;
}

export interface PesquisaPublica {
  id: string;
  protocolo: string | null;
  titulo: string;
  resumo: string;
  palavrasChave: string;
  subareaCode: string;
  subareaNome: string;
  ano: number | null;
  edital: { id: string; numero: string; tipoBolsa: BolsaTipo } | null;
  bolsista: string | null;
  orientador: { nome: string; departamento: string } | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
