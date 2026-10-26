import 'dotenv/config';
import path from 'node:path';
import { createServer } from 'node:http';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { prisma } from '../../../packages/database/client';
import { authRouter, requireAdmin } from './auth';
import { questionsRouter } from './routes/questions';
import { adminRouter } from './routes/admin';
import { GameService } from './services/game';
import { registerSockets } from './sockets';
import { codeSchema, errorMessage } from './validation';
const port = Number(process.env.API_PORT || 4001);
const origins = (process.env.WEB_ORIGIN || 'http://localhost:3005,http://127.0.0.1:3005')
  .split(',')
  .map((v) => v.trim());
const allowed = (origin?: string) => !origin || origins.includes(origin);
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: (origin, cb) => cb(null, allowed(origin)), credentials: true }));
app.use((req, res, next) => {
  if (
    req.method !== 'GET' &&
    req.method !== 'HEAD' &&
    req.method !== 'OPTIONS' &&
    !allowed(req.get('Origin'))
  ) {
    res.status(403).json({ error: 'Origin tidak diizinkan' });
    return;
  }
  next();
});
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak permintaan' },
  }),
);
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: origins, credentials: true },
  maxHttpBufferSize: 32768,
  allowRequest: (req, cb) => cb(null, allowed(req.headers.origin)),
});
const game = new GameService(io);
app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', database: 'connected', service: 'medical-tug-of-war' });
});
app.use('/api/auth', authRouter);
app.get('/api/rooms/:code', (req, res) =>
  res.json(game.serialize(codeSchema.parse(req.params.code))),
);
app.use(
  '/uploads',
  express.static(path.resolve('apps/realtime-server/uploads'), {
    dotfiles: 'deny',
    maxAge: '1d',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }),
);
app.use('/api', requireAdmin, questionsRouter, adminRouter(game));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
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
async function main() {
  await prisma.$connect();
  await game.initialize();
  registerSockets(io, game);
  server.listen(port, '0.0.0.0', () => console.log(`Medical realtime/API listening on ${port}`));
}
void main().catch((e) => {
  console.error('Server failed to start', e);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    io.close();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
