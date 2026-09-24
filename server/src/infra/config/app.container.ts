import express, { type Express, type Router } from 'express';

import { SystemClock, type Clock } from '@shared/time/clock';
import {
  createAuthenticationGuard,
  type UserDirectory,
} from '@shared/auth/auth.middleware';
import { JwtUserDirectory } from '@shared/auth/jwt.user-directory';

import { AuthService, JwtTokenSigner } from '@auth/auth.service';
import { registerAuthRoutes } from '@auth/auth.controller';
import type { UsuariosRepository } from '@auth/repositories/usuarios.repository';

import { EditaisService, type EditalEventsPort } from '@editais/editais.service';
import { InMemoryEditaisRepository, type EditaisRepository } from '@editais/repositories/editais.repository';
import { registerEditaisRoutes } from '@editais/editais.controller';
import { NotificacoesService } from '@notificacoes/notificacoes.service';
import {
  InMemoryNotificacoesRepository,
  type NotificacoesRepository,
} from '@notificacoes/repositories/notificacoes.repository';
import { registerNotificacoesRoutes } from '@notificacoes/notificacoes.controller';
import { registerPublicoRoutes } from '@publico/publico.controller';
import { errorHandler } from '@shared/http/http.middleware';
import { registerCnpqRoutes } from '@shared/domain/cnpq.routes';

import { createPrismaClient } from '../persistence/prisma.client';
import { PrismaEditaisRepository } from '../persistence/prisma.editais.repository';
import { PrismaNotificacoesRepository } from '../persistence/prisma.notificacoes.repository';
import { PrismaUsuariosRepository } from '../persistence/prisma.usuarios.repository';
import { InMemoryUsuariosRepository } from '@auth/repositories/usuarios.repository';

export interface AppContainerOptions {
  clock?: Clock;
  /** Ativa persistência REAL (Prisma/SQLite). Padrão: in-memory (testes/CI). */
  usePrisma?: boolean;
  editaisRepository?: EditaisRepository;
  notificacoesRepository?: NotificacoesRepository;
  usuariosRepository?: UsuariosRepository;
  userDirectory?: UserDirectory & { listUsers(): { id: string }[] };
  jwtSecret?: string;
}

export interface AppContainer {
  app: Express;
  clock: Clock;
  editaisRepository: EditaisRepository;
  notificacoesRepository: NotificacoesRepository;
  usuariosRepository: UsuariosRepository;
  editaisService: EditaisService;
  notificacoesService: NotificacoesService;
  authService: AuthService;
  /** Fecha a conexão Prisma quando a persistência real está ativa. */
  disconnect?: () => Promise<void>;
}

/** Porta de eventos: o service de editais notifica o módulo de notificações via este adapter. */
function createEditalEventsAdapter(notificacoesService: NotificacoesService): EditalEventsPort {
  return {
    onEditalPublicado: (event) => notificacoesService.handleEditalPublicado(event),
  };
}

/**
 * Composição de dependências da aplicação.
 * - Bootstrap (index.ts): Prisma REAL (SQLite) + JWT — persistência durável.
 * - Testes: repositórios in-memory, clock congelado e directories falsos.
 */
export function buildApp(options: AppContainerOptions = {}): AppContainer {
  const clock = options.clock ?? new SystemClock();

  // ── Persistência: Prisma real ou in-memory ─────────────────────────────
  const editaisRepository =
    options.editaisRepository ??
    (options.usePrisma ? new PrismaEditaisRepository(createPrismaClientOnce()) : new InMemoryEditaisRepository());

  const notificacoesRepository =
    options.notificacoesRepository ??
    (options.usePrisma ? new PrismaNotificacoesRepository(createPrismaClientOnce()) : new InMemoryNotificacoesRepository());

  const usuariosRepository =
    options.usuariosRepository ??
    (options.usePrisma ? new PrismaUsuariosRepository(createPrismaClientOnce()) : new InMemoryUsuariosRepository());
  const usingPrisma = !options.editaisRepository && !options.notificacoesRepository && !options.usuariosRepository && options.usePrisma === true;

  // ── Auth (JWT + bcrypt) ────────────────────────────────────────────────
  const jwtSecret = options.jwtSecret ?? process.env['JWT_SECRET'] ?? 'dev-secret-change-me';
  const authService = new AuthService(usuariosRepository, new JwtTokenSigner(jwtSecret));
  const userDirectory: UserDirectory = options.userDirectory ?? new JwtUserDirectory(authService);

  const notificacoesService = new NotificacoesService(notificacoesRepository, {
    listUsers: async () => {
      if (options.userDirectory) {
        return options.userDirectory.listUsers();
      }
      const usuarios = await usuariosRepository.list();
      return usuarios.map((u) => ({ id: u.id }));
    },
  });
  const editaisService = new EditaisService(
    editaisRepository,
    clock,
    createEditalEventsAdapter(notificacoesService),
  );

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const router: Router = express.Router();
  const authenticationGuard = createAuthenticationGuard(userDirectory);

  registerAuthRoutes(router, authService);
  registerEditaisRoutes(router, editaisService, authenticationGuard);
  registerNotificacoesRoutes(router, notificacoesService, authenticationGuard);
  registerPublicoRoutes(router, editaisService, clock);
  registerCnpqRoutes(router);

  app.use(router);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'portal-pibic-server', sprint: 'S2' });
  });

  app.use(errorHandler);

  return {
    app,
    clock,
    editaisRepository,
    notificacoesRepository,
    usuariosRepository,
    editaisService,
    notificacoesService,
    authService,
    disconnect: usingPrisma ? () => createPrismaClientOnce().$disconnect() : undefined,
  };
}

/** Client Prisma singleton — compartilhado entre os repositórios do container. */
let prismaSingleton: ReturnType<typeof createPrismaClient> | undefined;
function createPrismaClientOnce() {
  prismaSingleton = prismaSingleton ?? createPrismaClient();
  return prismaSingleton;
}
