import type { PrismaClient } from './prisma.client';

import type { UserRole } from '../../shared/auth/auth.types';
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
        departamento: usuario.departamento,
        matricula: usuario.matricula,
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

  async findManyByIds(ids: readonly string[]): Promise<Usuario[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.usuario.findMany({ where: { id: { in: [...ids] } } });
    return rows.map(toDomain);
  }

  async list(role?: UserRole): Promise<Usuario[]> {
    const all = await this.prisma.usuario.findMany({
      where: role ? { role } : undefined,
      orderBy: { nome: 'asc' },
    });
    return all.map(toDomain);
  }

  async update(usuario: Usuario): Promise<Usuario> {
    const updated = await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: usuario.nome,
        role: usuario.role,
        departamento: usuario.departamento,
        matricula: usuario.matricula,
      },
    });
    return toDomain(updated);
  }

  /** Limpa TODAS as tabelas na ordem das FKs — usado pelos testes E2E. */
  async clear(): Promise<void> {
    await this.prisma.relatorio.deleteMany();
    await this.prisma.avaliacao.deleteMany();
    await this.prisma.anexo.deleteMany();
    await this.prisma.inscricao.deleteMany();
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
  departamento: string;
  matricula: string | null;
  criadoEm: Date;
};

function toDomain(row: UsuarioRow): Usuario {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    senhaHash: row.senhaHash,
    role: row.role as UserRole,
    departamento: row.departamento,
    matricula: row.matricula,
    criadoEm: row.criadoEm,
  };
}
