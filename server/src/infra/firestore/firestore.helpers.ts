import { Timestamp, type DocumentData, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

/**
 * Nomes das coleções. Os índices de unicidade (`*_unicos`) existem porque o
 * Firestore não tem restrição UNIQUE: um documento cujo id é a chave única é
 * criado na mesma escrita, e a criação falha se ele já existir.
 */
export const COLECOES = {
  usuarios: 'usuarios',
  usuariosEmails: 'usuarios_emails_unicos',
  editais: 'editais',
  editaisNumeros: 'editais_numeros_unicos',
  inscricoes: 'inscricoes',
  sequenciasProtocolo: 'sequencias_protocolo',
  travasCota: 'travas_cota',
  candidaturas: 'candidaturas',
  candidaturasUnicas: 'candidaturas_unicas',
  avaliacoes: 'avaliacoes',
  relatorios: 'relatorios',
  relatoriosVersoes: 'relatorios_versoes_unicas',
  notificacoes: 'notificacoes',
  auditoria: 'auditoria',
  limitesTentativa: 'limites_tentativa',
} as const;

/** Código gRPC devolvido quando `create()` encontra um documento com o mesmo id. */
const ALREADY_EXISTS = 6;

export function jaExiste(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === ALREADY_EXISTS;
}

/** O Firestore devolve Timestamp; o domínio trabalha com Date (inclusive dentro de listas). */
export function paraDominio<T>(data: DocumentData): T {
  return converterDatas(data) as T;
}

function converterDatas(valor: unknown): unknown {
  if (valor instanceof Timestamp) return valor.toDate();
  if (Array.isArray(valor)) return valor.map(converterDatas);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, converterDatas(v)]));
  }
  return valor;
}

/** Id de documento seguro a partir de qualquer texto ("06/2026" tem barra, que o Firestore não aceita). */
export function idSeguro(...partes: string[]): string {
  return partes.map((p) => encodeURIComponent(p).replace(/\./g, '%2E')).join('__');
}

/** O Firestore aceita até 500 escritas por lote. */
export function emLotes<T>(itens: readonly T[], tamanho = 450): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

/** Apaga todos os documentos de uma coleção (usado só por testes e pelo reset do seed). */
export async function apagarColecao(db: Firestore, nome: string): Promise<void> {
  const refs = await db.collection(nome).listDocuments();
  for (const lote of emLotes(refs)) {
    const batch = db.batch();
    lote.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Converte os documentos e ordena pela data do domínio. As consultas evitam
 * orderBy para não exigir índices compostos. No empate (mesmo instante), vale a
 * ordem em que os documentos foram criados, como nos repositórios em memória;
 * sem isso o Firestore devolveria na ordem do id, que é aleatória.
 */
export function ordenarPorData<T>(
  docs: readonly QueryDocumentSnapshot[],
  converter: (data: DocumentData) => T,
  campo: (item: T) => Date,
  ordem: 'asc' | 'desc' = 'asc',
): T[] {
  const sinal = ordem === 'asc' ? 1 : -1;
  return docs
    .map((doc) => ({ item: converter(doc.data()), criado: doc.createTime }))
    .sort(
      (a, b) =>
        sinal * (campo(a.item).getTime() - campo(b.item).getTime()) ||
        a.criado.seconds - b.criado.seconds ||
        a.criado.nanoseconds - b.criado.nanoseconds,
    )
    .map(({ item }) => item);
}
