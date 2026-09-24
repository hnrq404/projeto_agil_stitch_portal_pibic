/** Tipos compartilhados do frontend — espelham os DTOs do backend. */

export type UserRole = 'GESTOR' | 'USUARIO';
export type EditalStatus = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO';
export type BolsaTipo = 'PIBIC' | 'PIBITI' | 'PIBIC_AF' | 'VOLUNTARIO';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  usuario: AuthUser;
}

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
  dataInicioInscricoes: string;
  dataFimInscricoes: string;
  publicadoEm: string | null;
  encerradoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CnpqArea {
  code: string;
  name: string;
}

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referenceId: string | null;
  lida: boolean;
  criadoEm: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
