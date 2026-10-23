import type { Firestore } from 'firebase-admin/firestore';

import { ConflictError } from '../../shared/errors/domain.errors';
import { normalizeRole, type UserRole } from '../../shared/auth/auth.types';
import type { Usuario } from '../../modules/auth/domain/auth.types';
import type { UsuariosRepository } from '../../modules/auth/repositories/usuarios.repository';

import { apagarColecao, COLECOES, idSeguro, jaExiste, paraDominio } from './firestore.helpers';

/** Adapter Firestore da porta UsuariosRepository. O e-mail é único via coleção de índice. */
export class FirestoreUsuariosRepository implements UsuariosRepository {
  constructor(private readonly db: Firestore) {}

  private get colecao() {
    return this.db.collection(COLECOES.usuarios);
  }

  async create(usuario: Usuario): Promise<Usuario> {
    const batch = this.db.batch();
    batch.create(this.db.collection(COLECOES.usuariosEmails).doc(idSeguro(usuario.email)), { usuarioId: usuario.id });
    batch.create(this.colecao.doc(usuario.id), { ...usuario, senhaAlteradaEm: usuario.senhaAlteradaEm ?? null });
    try {
      await batch.commit();
    } catch (error) {
      if (jaExiste(error)) throw new ConflictError('Já existe uma conta com este e-mail.', { email: usuario.email });
      throw error;
    }
    return { ...usuario };
  }

  async findByEmail(email: string): Promise<Usuario | undefined> {
    const snap = await this.colecao.where('email', '==', email.trim().toLowerCase()).limit(1).get();
    const doc = snap.docs[0];
    return doc ? toDomain(doc.data()) : undefined;
  }

  async findById(id: string): Promise<Usuario | undefined> {
    const doc = await this.colecao.doc(id).get();
    return doc.exists ? toDomain(doc.data()!) : undefined;
  }

  async findManyByIds(ids: readonly string[]): Promise<Usuario[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];
    const docs = await this.db.getAll(...unicos.map((id) => this.colecao.doc(id)));
    return docs.filter((d) => d.exists).map((d) => toDomain(d.data()!));
  }

  async list(role?: UserRole): Promise<Usuario[]> {
    const snap = role ? await this.colecao.where('role', '==', role).get() : await this.colecao.get();
    return snap.docs.map((d) => toDomain(d.data())).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async update(usuario: Usuario): Promise<Usuario> {
    // O e-mail não muda por aqui (não há tela para isso): o índice de unicidade continua válido.
    await this.colecao.doc(usuario.id).set({ ...usuario, senhaAlteradaEm: usuario.senhaAlteradaEm ?? null });
    return { ...usuario };
  }

  /** Apaga TODAS as coleções, como o clear do adapter SQL fazia por causa das FKs (testes E2E). */
  async clear(): Promise<void> {
    for (const nome of Object.values(COLECOES)) {
      await apagarColecao(this.db, nome);
    }
  }
}

function toDomain(data: FirebaseFirestore.DocumentData): Usuario {
  const usuario = paraDominio<Usuario>(data);
  return { ...usuario, role: normalizeRole(usuario.role), senhaAlteradaEm: usuario.senhaAlteradaEm ?? null };
}
