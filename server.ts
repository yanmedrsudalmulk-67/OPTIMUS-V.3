import 'dotenv/config';
import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import next from 'next';

const dbPath = path.resolve('packages/database/prisma/dev.db');
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = `file:${dbPath}`;
}

import { prisma } from './packages/database/client';
import { authRouter, requireAdmin } from './apps/realtime-server/src/auth';
import { questionsRouter } from './apps/realtime-server/src/routes/questions';
import { adminRouter } from './apps/realtime-server/src/routes/admin';
import { GameService } from './apps/realtime-server/src/services/game';
import { registerSockets } from './apps/realtime-server/src/sockets';
import { codeSchema, errorMessage } from './apps/realtime-server/src/validation';

const port = Number(process.env.PORT || 3005);
const dev = process.env.NODE_ENV !== 'production';

const configuredOrigins = (
  process.env.WEB_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

function isOriginAllowed(origin?: string, requestHost?: string): boolean {
  if (!origin) return true;
  if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (requestHost && parsed.host === requestHost) return true;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
    if (
      parsed.hostname.endsWith('.run.app') ||
      parsed.hostname.endsWith('.googleusercontent.com')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function ensureDatabaseReady() {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const schemaPath = path.resolve('packages/database/prisma/schema.prisma');

  let needsPush = !existsSync(dbPath);
  if (!needsPush) {
    try {
      await prisma.questionPackage.count();
    } catch {
      needsPush = true;
    }
  }

  if (needsPush) {
    console.log('Initializing SQLite database schema...');
    execSync(`npx prisma db push --skip-generate --schema "${schemaPath}"`, {
      stdio: 'inherit',
      env: process.env,
    });
  }

  const packageCount = await prisma.questionPackage.count();
  if (packageCount === 0) {
    console.log('Seeding default medical question packages and characters...');
    execSync(`npx tsx "${path.resolve('packages/database/seed.ts')}"`, {
      stdio: 'inherit',
      env: process.env,
    });
  }
}

async function main() {
  await prisma.$connect();
  await ensureDatabaseReady();

  const nextApp = next({
    dev,
    dir: path.resolve('apps/web'),
    hostname: '0.0.0.0',
    port,
  });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const server = createServer(app);
  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
      credentials: true,
    },
    maxHttpBufferSize: 32768,
    allowRequest: (req, cb) => cb(null, isOriginAllowed(req.headers.origin, req.headers.host)),
  });

  const game = new GameService(io);
  await game.initialize();
  registerSockets(io, game);

  // Heartbeat / shutdown no-op endpoints for AutoShutdownListener
  app.post('/system-api/heartbeat', (_req, res) => {
    res.status(204).end();
  });
  app.post('/system-api/shutdown', (_req, res) => {
    res.status(204).end();
  });

  // API middleware stack scoped to /api and /uploads
  const apiApp = express.Router();
  apiApp.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
      frameguard: false,
    }),
  );
  apiApp.use(
    cors({
      origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
      credentials: true,
    }),
  );
  apiApp.use((req, res, nextFn) => {
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.method !== 'OPTIONS' &&
      !isOriginAllowed(req.get('Origin'), req.get('Host'))
    ) {
      res.status(403).json({ error: 'Origin tidak diizinkan' });
      return;
    }
    nextFn();
  });
  apiApp.use(express.json({ limit: '4mb' }));
  apiApp.use(cookieParser());
  apiApp.use(
    rateLimit({
      windowMs: 60000,
      limit: 500,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Terlalu banyak permintaan' },
    }),
  );

  apiApp.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', service: 'medical-tug-of-war' });
  });
  apiApp.use('/auth', authRouter);
  apiApp.get('/public/packages', async (_req, res) => res.json(await game.getPublicCatalog()));
  apiApp.get('/public/leaderboard', async (_req, res) => {
    const players = await prisma.matchPlayer.findMany({
      where: { match: { phase: 'FINISHED' } },
      orderBy: [{ score: 'desc' }, { correctCount: 'desc' }],
      take: 50,
    });
    res.json(
      players.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        score: p.score,
        correctCount: p.correctCount,
        power: p.power,
        matches: 1,
      })),
    );
  });
  apiApp.post('/quick-matches', async (req, res) =>
    res.status(201).json(await game.createQuickMatch(req.body)),
  );
  apiApp.get('/rooms/:code', (req, res) =>
    res.json(game.serialize(codeSchema.parse(req.params.code))),
  );
  apiApp.use(requireAdmin, questionsRouter, adminRouter(game));
  apiApp.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
  apiApp.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (error?.code === 'P2025') {
      res.status(404).json({ error: 'Data tidak ditemukan' });
      return;
    }
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'Data sudah ada atau jawaban sudah dikirim' });
      return;
    }
    if (error?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Ukuran gambar maksimal 3 MB' });
      return;
    }
    const message = errorMessage(error);
    if (
      error?.name === 'ZodError' ||
      (error instanceof Error && !String(error.stack).includes('node_modules/@prisma'))
    ) {
      res.status(400).json({ error: message });
      return;
    }
    console.error('Request failed', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  });

  app.use('/api', apiApp);
  app.use(
    '/uploads',
    express.static(path.resolve('apps/realtime-server/uploads'), {
      dotfiles: 'deny',
      maxAge: '1d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // Forward all other routes to Next.js.
  // In dev mode, Next.js rejects /_next/static chunks with 403 when nginx sets
  // Host: localhost:3000 while the browser sends a proxied preview Origin.
  app.use((req, res) => {
    if (dev) {
      const origin = req.headers.origin;
      if (origin && isOriginAllowed(origin, req.headers.host)) {
        req.headers.origin = `http://localhost:${port}`;
      }
      const referer = req.headers.referer;
      if (referer) {
        try {
          const refUrl = new URL(referer);
          if (isOriginAllowed(refUrl.origin, req.headers.host)) {
            req.headers.referer = `http://localhost:${port}${refUrl.pathname}${refUrl.search}`;
          }
        } catch {
          // Ignore malformed referer
        }
      }
    }
    return handle(req, res);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Medical Tug of War server ready on http://0.0.0.0:${port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      io.close();
      server.close(() => {
        void prisma.$disconnect().finally(() => process.exit(0));
      });
    });
  }
}

void main().catch((e) => {
  console.error('Server failed to start', e);
  process.exitCode = 1;
});
