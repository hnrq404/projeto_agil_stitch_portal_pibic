import type { PrismaClient } from './prisma.client';

import type { Usuario } from '../../modules/auth/domain/auth.types';
import type { UsuariosRepository } from '../../modules/auth/repositories/usuarios.repository';

/** Adapter Prisma da porta UsuariosRepository (persistência REAL em SQLite). */
export class PrismaUsuariosRepository implements UsuariosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(usuario: Usuario): Promise<Usuario> {
    const created = await this.prisma.usuario.create({
      data: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        senhaHash: usuario.senhaHash,
        role: usuario.role,
        criadoEm: usuario.criadoEm,
      },
    });
    return toDomain(created);
  }

  async findByEmail(email: string): Promise<Usuario | undefined> {
    // E-mails são normalizados para lowercase na gravação — comparação direta.
    const found = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return found ? toDomain(found) : undefined;
  }

  async findById(id: string): Promise<Usuario | undefined> {
    const found = await this.prisma.usuario.findUnique({ where: { id } });
    return found ? toDomain(found) : undefined;
  }

  async list(): Promise<Usuario[]> {
    const all = await this.prisma.usuario.findMany({ orderBy: { criadoEm: 'asc' } });
    return all.map(toDomain);
  }

  async clear(): Promise<void> {
    await this.prisma.notificacao.deleteMany();
    await this.prisma.cotaSubarea.deleteMany();
    await this.prisma.edital.deleteMany();
    await this.prisma.usuario.deleteMany();
  }
}

type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  role: string;
  criadoEm: Date;
};

function toDomain(row: UsuarioRow): Usuario {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    senhaHash: row.senhaHash,
    role: row.role as Usuario['role'],
    criadoEm: row.criadoEm,
  };
}
