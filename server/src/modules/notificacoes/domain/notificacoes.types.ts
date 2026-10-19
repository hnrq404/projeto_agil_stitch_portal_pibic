/** Tipos de notificação in-app do portal, um por evento de domínio relevante ao usuário. */
export type NotificacaoTipo =
  | 'EDITAL_PUBLICADO'
  | 'EDITAL_ENCERRADO'
  /** Professor divulgou um projeto: avisa os alunos. */
  | 'PROJETO_DIVULGADO'
  /** Aluno se candidatou: avisa o professor. */
  | 'CANDIDATURA_RECEBIDA'
  /** Professor selecionou (ou não) o aluno. */
  | 'CANDIDATURA_RESULTADO'
  /** Professor enviou o projeto ao edital: avisa o aluno selecionado. */
  | 'PROJETO_ENVIADO'
  | 'AVALIACAO_ATRIBUIDA'
  | 'INSCRICAO_RESULTADO'
  | 'RELATORIO_ENVIADO'
  | 'RELATORIO_AVALIADO'
  /** Relatório mensal: lembrete antes do dia 5 e aviso de atraso depois dele. */
  | 'RELATORIO_LEMBRETE'
  | 'RELATORIO_ATRASADO'
  /** Do fluxo antigo (aluno indicava o orientador); só aparecem em notificações já gravadas. */
  | 'VINCULO_SOLICITADO'
  | 'VINCULO_RESPONDIDO';

/** Conteúdo de uma notificação direcionada (sem destinatário nem metadados). */
export interface NotificacaoInput {
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  referenceId?: string;
}

export interface Notificacao {
  id: string;
  userId: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  /** Referência opcional à entidade que originou o evento (ex.: id do edital). */
  referenceId?: string;
  lida: boolean;
  criadoEm: Date;
}

/** Evento de domínio emitido quando um edital é publicado — consumido pelo módulo de notificações. */
export interface EditalPublicadoEvent {
  editalId: string;
  numero: string;
  titulo: string;
  tipoBolsa: string;
  totalCotas: number;
  dataFimInscricoes: Date;
}
