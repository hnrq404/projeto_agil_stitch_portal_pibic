import path from 'node:path';

import express, { type Express, type Router } from 'express';

import { SystemClock, type Clock } from '@shared/time/clock';
import {
  createAuthenticationGuard,
  type UserDirectory,
} from '@shared/auth/auth.middleware';
import { JwtUserDirectory } from '@shared/auth/jwt.user-directory';
import {
  ArmazenamentoLocal,
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
import {
  InMemoryCandidaturasRepository,
  type CandidaturasRepository,
} from '@inscricoes/repositories/candidaturas.repository';
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
import { AuditoriaService } from '@auditoria/auditoria.service';
import { registerAuditoriaRoutes } from '@auditoria/auditoria.controller';
import {
  InMemoryAuditoriaRepository,
  type AuditoriaRepository,
} from '@auditoria/repositories/auditoria.repository';
import { errorHandler } from '@shared/http/http.middleware';
import { createRateLimiter, securityHeaders } from '@shared/http/security.middleware';
import { requestContext, requestLogger } from '@shared/http/request-context.middleware';
import { registerCnpqRoutes } from '@shared/domain/cnpq.routes';

import { registerArquivosLocaisRoutes } from '@shared/storage/arquivos-locais.controller';
import { VercelBlobStorage } from '@shared/storage/vercel-blob.storage';
import type { RateLimitStore } from '@shared/http/security.middleware';
import { createFirestoreRateLimitStore } from '../firestore/firestore.rate-limit.store';
import { resolveJwtSecret } from './env';
import { registerCronRoutes } from './cron.routes';
import { encerrarFirestore, obterFirestore } from '../firestore/firestore.client';
import { FirestoreEditaisRepository } from '../firestore/firestore.editais.repository';
import { FirestoreNotificacoesRepository } from '../firestore/firestore.notificacoes.repository';
import { FirestoreUsuariosRepository } from '../firestore/firestore.usuarios.repository';
import { FirestoreInscricoesRepository } from '../firestore/firestore.inscricoes.repository';
import { FirestoreCandidaturasRepository } from '../firestore/firestore.candidaturas.repository';
import { FirestoreAvaliacoesRepository } from '../firestore/firestore.avaliacoes.repository';
import { FirestoreRelatoriosRepository } from '../firestore/firestore.relatorios.repository';
import { FirestoreAuditoriaRepository } from '../firestore/firestore.auditoria.repository';

export interface AppContainerOptions {
  clock?: Clock;
  /**
   * Onde ficam os dados. `firestore`: emulador local ou projeto real (ver
   * firestore.client.ts). Padrão: `memoria` (testes de unidade e integração).
   */
  persistencia?: 'firestore' | 'memoria';
  editaisRepository?: EditaisRepository;
  notificacoesRepository?: NotificacoesRepository;
  usuariosRepository?: UsuariosRepository;
  inscricoesRepository?: InscricoesRepository;
  candidaturasRepository?: CandidaturasRepository;
  avaliacoesRepository?: AvaliacoesRepository;
  relatoriosRepository?: RelatoriosRepository;
  auditoriaRepository?: AuditoriaRepository;
  arquivoStorage?: ArquivoStorage;
  userDirectory?: UserDirectory & { listUsers(): { id: string }[] };
  jwtSecret?: string;
  /** Limite de tentativas em login/cadastro. Padrão: ligado, exceto com NODE_ENV=test. */
  authRateLimit?: boolean;
  /** Uma linha de log JSON por requisição da API. Padrão: ligado, exceto com NODE_ENV=test. */
  requestLogging?: boolean;
}

export interface AppContainer {
  app: Express;
  clock: Clock;
  editaisRepository: EditaisRepository;
  notificacoesRepository: NotificacoesRepository;
  usuariosRepository: UsuariosRepository;
  inscricoesRepository: InscricoesRepository;
  candidaturasRepository: CandidaturasRepository;
  avaliacoesRepository: AvaliacoesRepository;
  relatoriosRepository: RelatoriosRepository;
  auditoriaRepository: AuditoriaRepository;
  editaisService: EditaisService;
  notificacoesService: NotificacoesService;
  authService: AuthService;
  inscricoesService: InscricoesService;
  avaliacoesService: AvaliacoesService;
  projetosService: ProjetosService;
  arquivoStorage: ArquivoStorage;
  /** Fecha a conexão com o Firestore quando a persistência real está ativa. */
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
 * - Servidor local (index.ts) e função da Vercel (api/index.js): Firestore + JWT;
 *   PDFs no Vercel Blob quando há BLOB_READ_WRITE_TOKEN, senão em disco.
 * - Testes: repositórios in-memory, clock congelado e directories falsos.
 */
export function buildApp(options: AppContainerOptions = {}): AppContainer {
  const clock = options.clock ?? new SystemClock();
  const db = options.persistencia === 'firestore' ? obterFirestore() : undefined;
  const jwtSecret = options.jwtSecret ?? resolveJwtSecret();

  // ── Persistência: Firestore ou in-memory ───────────────────────────────
  const editaisRepository =
    options.editaisRepository ??
    (db ? new FirestoreEditaisRepository(db) : new InMemoryEditaisRepository());
  const notificacoesRepository =
    options.notificacoesRepository ??
    (db ? new FirestoreNotificacoesRepository(db) : new InMemoryNotificacoesRepository());
  const usuariosRepository =
    options.usuariosRepository ??
    (db ? new FirestoreUsuariosRepository(db) : new InMemoryUsuariosRepository());
  const inscricoesRepository =
    options.inscricoesRepository ??
    (db ? new FirestoreInscricoesRepository(db) : new InMemoryInscricoesRepository());
  const candidaturasRepository =
    options.candidaturasRepository ??
    (db ? new FirestoreCandidaturasRepository(db) : new InMemoryCandidaturasRepository());
  const avaliacoesRepository =
    options.avaliacoesRepository ??
    (db ? new FirestoreAvaliacoesRepository(db) : new InMemoryAvaliacoesRepository());
  const relatoriosRepository =
    options.relatoriosRepository ??
    (db ? new FirestoreRelatoriosRepository(db) : new InMemoryRelatoriosRepository());
  const auditoriaRepository =
    options.auditoriaRepository ??
    (db ? new FirestoreAuditoriaRepository(db) : new InMemoryAuditoriaRepository());
  const arquivoStorage = options.arquivoStorage ?? criarArquivoStorage(Boolean(db), jwtSecret);

  // ── Auth (JWT + bcrypt) ────────────────────────────────────────────────
  const authService = new AuthService(usuariosRepository, new JwtTokenSigner(jwtSecret));
  const userDirectory: UserDirectory = options.userDirectory ?? new JwtUserDirectory(authService);
  const usuariosService = new UsuariosService(usuariosRepository);
  const auditoriaService = new AuditoriaService(auditoriaRepository, clock);

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
  // implementa AvaliacoesPort (acesso do avaliador e os três indicados no envio).
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
    candidaturasRepository,
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
  // Atrás de proxy reverso (nginx, Render...), req.ip precisa vir do X-Forwarded-For;
  // sem isso o rate limit trata todos os usuários como um só IP. Ex.: TRUST_PROXY=1.
  const trustProxy = process.env['TRUST_PROXY'] ?? (process.env['VERCEL'] ? '1' : undefined);
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  app.use(requestContext());
  if (options.requestLogging ?? process.env['NODE_ENV'] !== 'test') {
    app.use(requestLogger());
  }
  app.use(securityHeaders());
  app.use(express.json({ limit: '1mb' }));

  // Contra força bruta de senha e criação de contas em massa (por IP).
  const authRateLimit = options.authRateLimit ?? process.env['NODE_ENV'] !== 'test';
  // Na Vercel cada requisição pode cair numa instância diferente: o contador fica no Firestore.
  const limiteStore: RateLimitStore | undefined = db ? createFirestoreRateLimitStore(db) : undefined;
  if (authRateLimit) {
    app.use(
      '/api/auth/login',
      createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 10,
        onlyFailures: true,
        store: limiteStore,
        prefixo: 'login',
        message: 'Muitas tentativas de login sem sucesso. Aguarde 15 minutos e tente novamente.',
      }),
    );
    app.use(
      '/api/auth/register',
      createRateLimiter({
        windowMs: 60 * 60 * 1000,
        max: 20,
        store: limiteStore,
        prefixo: 'cadastro',
        message: 'Muitos cadastros a partir desta rede. Aguarde uma hora e tente novamente.',
      }),
    );
    // Com um token roubado, a troca de senha viraria um jeito de testar senhas atuais.
    app.use(
      '/api/auth/senha',
      createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 10,
        store: limiteStore,
        prefixo: 'senha',
        message: 'Muitas tentativas de troca de senha. Aguarde 15 minutos e tente novamente.',
      }),
    );
  }

  const router: Router = express.Router();
  const authenticationGuard = createAuthenticationGuard(userDirectory);

  registerAuthRoutes(router, authService, authenticationGuard);
  registerUsuariosRoutes(router, usuariosService, authenticationGuard, auditoriaService);
  registerEditaisRoutes(router, editaisService, authenticationGuard, auditoriaService);
  registerNotificacoesRoutes(router, notificacoesService, authenticationGuard);
  registerInscricoesRoutes(router, inscricoesService, authenticationGuard);
  registerAvaliacoesRoutes(
    router,
    avaliacoesService,
    inscricoesService,
    usuariosRepository,
    authenticationGuard,
    auditoriaService,
  );
  registerProjetosRoutes(router, projetosService, inscricoesService, authenticationGuard);
  registerDashboardRoutes(router, dashboardService, authenticationGuard);
  registerAuditoriaRoutes(router, auditoriaService, authenticationGuard);
  registerPublicoRoutes(router, {
    editaisService,
    inscricoesService,
    inscricoes: inscricoesRepository,
    usuarios: usuariosRepository,
    clock,
  });
  registerCnpqRoutes(router);
  registerCronRoutes(router, { editaisService, projetosService });
  if (arquivoStorage instanceof ArmazenamentoLocal) {
    registerArquivosLocaisRoutes(router, arquivoStorage);
  }

  app.use(router);

  // Liveness: o processo responde.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'portal-pibic-server' });
  });

  // Readiness: o processo responde E o banco também (para o orquestrador/balanceador).
  app.get('/api/health/ready', (req, res) => {
    if (!db) {
      res.json({ status: 'ok', banco: 'memoria' });
      return;
    }
    db.collection('saude')
      .limit(1)
      .get()
      .then(() => res.json({ status: 'ok', banco: 'ok' }))
      .catch((error: unknown) => {
        console.error('[health] Banco indisponível', { requestId: req.requestId }, error);
        res.status(503).json({ status: 'erro', banco: 'indisponivel' });
      });
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
    candidaturasRepository,
    avaliacoesRepository,
    relatoriosRepository,
    auditoriaRepository,
    editaisService,
    notificacoesService,
    authService,
    inscricoesService,
    avaliacoesService,
    projetosService,
    arquivoStorage,
    disconnect: db ? () => encerrarFirestore() : undefined,
  };
}

/**
 * PDFs: Vercel Blob quando há token (produção ou quem quiser testar o Blob de
 * verdade); disco no dev local com Firestore; memória nos testes.
 */
function criarArquivoStorage(persistente: boolean, jwtSecret: string): ArquivoStorage {
  const blobToken = process.env['BLOB_READ_WRITE_TOKEN'];
  if (blobToken) return new VercelBlobStorage(blobToken);
  // As URLs locais são assinadas com uma chave derivada do segredo do JWT (nunca o próprio segredo).
  const segredo = `arquivos:${jwtSecret}`;
  if (!persistente) return new InMemoryArquivoStorage(segredo);
  if (process.env['VERCEL']) {
    throw new Error('Na Vercel não há disco permanente: configure o Vercel Blob (BLOB_READ_WRITE_TOKEN).');
  }
  return new DiskArquivoStorage(path.resolve(__dirname, '..', '..', '..', process.env['UPLOADS_DIR'] ?? 'uploads'), segredo);
}
