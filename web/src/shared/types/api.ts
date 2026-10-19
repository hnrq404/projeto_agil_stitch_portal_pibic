/**
 * Contrato da API (espelha os DTOs de server/src/modules/* /dto).
 * Mudou o backend? Ajuste aqui: o TypeScript aponta cada tela afetada.
 */

/** O docente também é o avaliador dos projetos de colegas (papéis unificados). */
export type UserRole = 'DISCENTE' | 'DOCENTE' | 'GESTOR' | 'ADMIN' | 'USUARIO';
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

// ── Projetos de pesquisa (inscrições) ──────────────────────────────────────

/** RASCUNHO → DIVULGADA (alunos se candidatam) → EM_AVALIACAO (enviado ao edital) → AVALIADA → APROVADA | RECUSADA */
export type InscricaoStatus =
  | 'RASCUNHO'
  | 'DIVULGADA'
  | 'EM_AVALIACAO'
  | 'AVALIADA'
  | 'APROVADA'
  | 'RECUSADA';
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
  /** Aluno selecionado pelo professor (nulo até a seleção). */
  discente: Pessoa | null;
  /** Professor dono do projeto. */
  orientador: Pessoa | null;
  anexos: Anexo[];
  homologacaoJustificativa: string | null;
  divulgadaEm: string | null;
  submetidaEm: string | null;
  homologadaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Checklist do envio, presente só para o professor dono enquanto o projeto é editável. */
  pendencias?: string[];
}

export interface RascunhoInput {
  titulo?: string;
  subareaCode?: string;
  palavrasChave?: string;
  resumo?: string;
  objetivos?: string;
  metodologia?: string;
}

/** Projeto divulgado visto por alunos e visitantes (sem anexos nem contatos). */
export interface ProjetoDivulgado {
  id: string;
  titulo: string;
  resumo: string;
  objetivos: string;
  metodologia: string;
  palavrasChave: string;
  subareaCode: string;
  subareaNome: string;
  edital: Inscricao['edital'];
  orientador: { nome: string; departamento: string } | null;
  divulgadaEm: string | null;
}

export type CandidaturaStatus = 'PENDENTE' | 'SELECIONADA' | 'NAO_SELECIONADA';

export interface Candidatura {
  id: string;
  inscricaoId: string;
  status: CandidaturaStatus;
  mensagem: string;
  criadoEm: string;
  respondidaEm: string | null;
  discente: (Pessoa & { matricula: string | null }) | null;
  /** Presente nas candidaturas do próprio aluno. */
  projeto?: ProjetoDivulgado & { status: InscricaoStatus };
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

/** MENSAL: até o dia 5, sobre o mês anterior. FINAL: ao fim da vigência, com PDF. */
export type RelatorioTipo = 'MENSAL' | 'FINAL';
export type RelatorioStatus = 'ENVIADO' | 'APROVADO' | 'DEVOLVIDO';
export type SituacaoRelatorio = 'AGUARDANDO_ENVIO' | 'ATRASADO' | 'EM_ANALISE' | 'DEVOLVIDO' | 'APROVADO';

export interface Relatorio {
  id: string;
  tipo: RelatorioTipo;
  /** "2026-09" no mensal; nulo no final. */
  competencia: string | null;
  versao: number;
  status: RelatorioStatus;
  descricao: string;
  arquivo: { nome: string; tamanho: number } | null;
  comentarioOrientador: string | null;
  enviadoEm: string;
  avaliadoEm: string | null;
}

export interface AcompanhamentoRelatorio {
  tipo: RelatorioTipo;
  competencia: string | null;
  prazo: string;
  situacao: SituacaoRelatorio;
}

export interface ProjetoDetalhe {
  projeto: Inscricao;
  relatorios: Relatorio[];
  acompanhamento: AcompanhamentoRelatorio[];
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
  | 'PROJETO_DIVULGADO'
  | 'CANDIDATURA_RECEBIDA'
  | 'CANDIDATURA_RESULTADO'
  | 'PROJETO_ENVIADO'
  | 'AVALIACAO_ATRIBUIDA'
  | 'INSCRICAO_RESULTADO'
  | 'RELATORIO_ENVIADO'
  | 'RELATORIO_AVALIADO'
  | 'RELATORIO_LEMBRETE'
  | 'RELATORIO_ATRASADO'
  /** Do fluxo antigo; só em notificações já gravadas. */
  | 'VINCULO_SOLICITADO'
  | 'VINCULO_RESPONDIDO';

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
