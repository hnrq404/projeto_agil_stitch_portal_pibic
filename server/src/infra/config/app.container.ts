import path from 'node:path';

import express, { type Express, type Router } from 'express';

import { SystemClock, type Clock } from '@shared/time/clock';
import {
  createAuthenticationGuard,
  type UserDirectory,
} from '@shared/auth/auth.middleware';
import { JwtUserDirectory } from '@shared/auth/jwt.user-directory';
import {
  DiskArquivoStorage,
  InMemoryArquivoStorage,
  type ArquivoStorage,
} from '@shared/storage/arquivo.storage';

import { AuthService, JwtTokenSigner } from '@auth/auth.service';
import { registerAuthRoutes } from '@auth/auth.controller';
import {
  InMemoryUsuariosRepository,
  type UsuariosRepository,
} from '@auth/repositories/usuarios.repository';
import { UsuariosService } from '@auth/usuarios.service';
import { registerUsuariosRoutes } from '@auth/usuarios.controller';

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
import { InscricoesService } from '@inscricoes/inscricoes.service';
import {
  InMemoryInscricoesRepository,
  type InscricoesRepository,
} from '@inscricoes/repositories/inscricoes.repository';
import { registerInscricoesRoutes } from '@inscricoes/inscricoes.controller';
import { AvaliacoesService } from '@avaliacoes/avaliacoes.service';
import {
  InMemoryAvaliacoesRepository,
  type AvaliacoesRepository,
} from '@avaliacoes/repositories/avaliacoes.repository';
import { registerAvaliacoesRoutes } from '@avaliacoes/avaliacoes.controller';
import { ProjetosService } from '@projetos/projetos.service';
import {
  InMemoryRelatoriosRepository,
  type RelatoriosRepository,
} from '@projetos/repositories/relatorios.repository';
import { registerProjetosRoutes } from '@projetos/projetos.controller';
import { DashboardService } from '@dashboard/dashboard.service';
import { registerDashboardRoutes } from '@dashboard/dashboard.controller';
import { errorHandler } from '@shared/http/http.middleware';
import { createRateLimiter, securityHeaders } from '@shared/http/security.middleware';
import { registerCnpqRoutes } from '@shared/domain/cnpq.routes';

import { createPrismaClient } from '../persistence/prisma.client';
import { resolveJwtSecret } from './env';
import { PrismaEditaisRepository } from '../persistence/prisma.editais.repository';
import { PrismaNotificacoesRepository } from '../persistence/prisma.notificacoes.repository';
import { PrismaUsuariosRepository } from '../persistence/prisma.usuarios.repository';
import { PrismaInscricoesRepository } from '../persistence/prisma.inscricoes.repository';
import { PrismaAvaliacoesRepository } from '../persistence/prisma.avaliacoes.repository';
import { PrismaRelatoriosRepository } from '../persistence/prisma.relatorios.repository';

export interface AppContainerOptions {
  clock?: Clock;
  /** Ativa persistência REAL (Prisma/SQLite + PDFs em disco). Padrão: in-memory (testes/CI). */
  usePrisma?: boolean;
  editaisRepository?: EditaisRepository;
  notificacoesRepository?: NotificacoesRepository;
  usuariosRepository?: UsuariosRepository;
  inscricoesRepository?: InscricoesRepository;
  avaliacoesRepository?: AvaliacoesRepository;
  relatoriosRepository?: RelatoriosRepository;
  arquivoStorage?: ArquivoStorage;
  userDirectory?: UserDirectory & { listUsers(): { id: string }[] };
  jwtSecret?: string;
  /** Limite de tentativas em login/cadastro. Padrão: ligado, exceto com NODE_ENV=test. */
  authRateLimit?: boolean;
}

export interface AppContainer {
  app: Express;
  clock: Clock;
  editaisRepository: EditaisRepository;
  notificacoesRepository: NotificacoesRepository;
  usuariosRepository: UsuariosRepository;
  inscricoesRepository: InscricoesRepository;
  avaliacoesRepository: AvaliacoesRepository;
  relatoriosRepository: RelatoriosRepository;
  editaisService: EditaisService;
  notificacoesService: NotificacoesService;
  authService: AuthService;
  inscricoesService: InscricoesService;
  avaliacoesService: AvaliacoesService;
  projetosService: ProjetosService;
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
 * - Bootstrap (index.ts): Prisma REAL (SQLite) + JWT + PDFs em disco.
 * - Testes: repositórios in-memory, clock congelado e directories falsos.
 */
export function buildApp(options: AppContainerOptions = {}): AppContainer {
  const clock = options.clock ?? new SystemClock();
  const prisma = options.usePrisma ? createPrismaClientOnce() : undefined;

  // ── Persistência: Prisma real ou in-memory ─────────────────────────────
  const editaisRepository =
    options.editaisRepository ??
    (prisma ? new PrismaEditaisRepository(prisma) : new InMemoryEditaisRepository());
  const notificacoesRepository =
    options.notificacoesRepository ??
    (prisma ? new PrismaNotificacoesRepository(prisma) : new InMemoryNotificacoesRepository());
  const usuariosRepository =
    options.usuariosRepository ??
    (prisma ? new PrismaUsuariosRepository(prisma) : new InMemoryUsuariosRepository());
  const inscricoesRepository =
    options.inscricoesRepository ??
    (prisma ? new PrismaInscricoesRepository(prisma) : new InMemoryInscricoesRepository());
  const avaliacoesRepository =
    options.avaliacoesRepository ??
    (prisma ? new PrismaAvaliacoesRepository(prisma) : new InMemoryAvaliacoesRepository());
  const relatoriosRepository =
    options.relatoriosRepository ??
    (prisma ? new PrismaRelatoriosRepository(prisma) : new InMemoryRelatoriosRepository());
  const arquivoStorage =
    options.arquivoStorage ??
    (prisma
      ? new DiskArquivoStorage(path.resolve(__dirname, '..', '..', '..', process.env['UPLOADS_DIR'] ?? 'uploads'))
      : new InMemoryArquivoStorage());

  // ── Auth (JWT + bcrypt) ────────────────────────────────────────────────
  const jwtSecret = options.jwtSecret ?? resolveJwtSecret();
  const authService = new AuthService(usuariosRepository, new JwtTokenSigner(jwtSecret));
  const userDirectory: UserDirectory = options.userDirectory ?? new JwtUserDirectory(authService);
  const usuariosService = new UsuariosService(usuariosRepository);

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

  // Avaliações e inscrições se conhecem por portas: o service de avaliações
  // implementa AvaliadorAccessPort (acesso do avaliador às propostas).
  const avaliacoesService = new AvaliacoesService(
    avaliacoesRepository,
    inscricoesRepository,
    editaisRepository,
    usuariosRepository,
    clock,
    notificacoesService,
  );
  const inscricoesService = new InscricoesService(
    inscricoesRepository,
    editaisRepository,
    usuariosRepository,
    arquivoStorage,
    clock,
    notificacoesService,
    avaliacoesService,
  );
  const projetosService = new ProjetosService(
    inscricoesRepository,
    inscricoesService,
    relatoriosRepository,
    arquivoStorage,
    clock,
    notificacoesService,
  );
  const dashboardService = new DashboardService(
    editaisRepository,
    inscricoesRepository,
    avaliacoesRepository,
    relatoriosRepository,
    clock,
  );

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders());
  app.use(express.json({ limit: '1mb' }));

  // Contra força bruta de senha e criação de contas em massa (por IP).
  const authRateLimit = options.authRateLimit ?? process.env['NODE_ENV'] !== 'test';
  if (authRateLimit) {
    app.use(
      '/api/auth/login',
      createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 10,
        onlyFailures: true,
        message: 'Muitas tentativas de login sem sucesso. Aguarde 15 minutos e tente novamente.',
      }),
    );
    app.use(
      '/api/auth/register',
      createRateLimiter({
        windowMs: 60 * 60 * 1000,
        max: 20,
        message: 'Muitos cadastros a partir desta rede. Aguarde uma hora e tente novamente.',
      }),
    );
  }

  const router: Router = express.Router();
  const authenticationGuard = createAuthenticationGuard(userDirectory);

  registerAuthRoutes(router, authService);
  registerUsuariosRoutes(router, usuariosService, authenticationGuard);
  registerEditaisRoutes(router, editaisService, authenticationGuard);
  registerNotificacoesRoutes(router, notificacoesService, authenticationGuard);
  registerInscricoesRoutes(router, inscricoesService, authenticationGuard);
  registerAvaliacoesRoutes(router, avaliacoesService, inscricoesService, usuariosRepository, authenticationGuard);
  registerProjetosRoutes(router, projetosService, inscricoesService, authenticationGuard);
  registerDashboardRoutes(router, dashboardService, authenticationGuard);
  registerPublicoRoutes(router, {
    editaisService,
    inscricoes: inscricoesRepository,
    usuarios: usuariosRepository,
    clock,
  });
  registerCnpqRoutes(router);

  app.use(router);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'portal-pibic-server' });
  });

  // Rotas /api inexistentes respondem JSON (e não caem no fallback da SPA).
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota da API não encontrada.' } });
  });

  app.use(errorHandler);

  return {
    app,
    clock,
    editaisRepository,
    notificacoesRepository,
    usuariosRepository,
    inscricoesRepository,
    avaliacoesRepository,
    relatoriosRepository,
    editaisService,
    notificacoesService,
    authService,
    inscricoesService,
    avaliacoesService,
    projetosService,
    disconnect: prisma ? () => prisma.$disconnect() : undefined,
  };
}

/** Client Prisma singleton — compartilhado entre os repositórios do container. */
let prismaSingleton: ReturnType<typeof createPrismaClient> | undefined;
function createPrismaClientOnce() {
  prismaSingleton = prismaSingleton ?? createPrismaClient();
  return prismaSingleton;
}
