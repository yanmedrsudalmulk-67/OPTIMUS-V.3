import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../../packages/database/client';
export const COOKIE = 'medical_admin';
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export function cookieToken(header?: string) {
  try {
    const item = header
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE + '='));
    return item ? decodeURIComponent(item.slice(COOKIE.length + 1)) : undefined;
  } catch {
    return undefined;
  }
}
export async function getAdmin(token?: string) {
  if (!token || token.length > 200) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { id: session.admin.id, username: session.admin.username };
}
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await getAdmin(req.cookies?.[COOKIE]);
    if (!admin) {
      res.status(401).json({ error: 'Silakan masuk sebagai administrator' });
      return;
    }
    res.locals.admin = admin;
    next();
  } catch (e) {
    next(e);
  }
}
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
};
export const authRouter = Router();
authRouter.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Terlalu banyak percobaan masuk. Coba lagi nanti.' },
  }),
  async (req, res) => {
    const data = z
      .object({
        username: z.string().trim().min(1).max(100),
        password: z
          .string()
          .min(1)
          .max(200)
          .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Kata sandi maksimal 72 byte'),
      })
      .parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { username: data.username } });
    // Always perform a password comparison to reduce account enumeration through timing.
    const dummy = '$2b$12$qrsj4ULNJYiP1N3Q9xdtZOY7O.0X7oVWjkQIHGxJ3e3dTFW8sQo9K';
    const valid = await bcrypt.compare(data.password, admin?.passwordHash || dummy);
    if (!admin || !valid) {
      res.status(401).json({ error: 'Nama pengguna atau kata sandi salah' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.adminSession.create({
      data: {
        tokenHash: hashToken(token),
        adminId: admin.id,
        expiresAt: new Date(Date.now() + cookieOptions.maxAge),
      },
    });
    res.cookie(COOKIE, token, cookieOptions).json({ id: admin.id, username: admin.username });
  },
);
authRouter.get('/me', requireAdmin, (_req, res) => res.json(res.locals.admin));
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  res.clearCookie(COOKIE, { path: '/' }).json({ ok: true });
});
authRouter.post('/password', requireAdmin, async (req, res) => {
  const data = z
    .object({
      currentPassword: z.string().max(200),
      password: z
        .string()
        .min(10)
        .max(200)
        .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Kata sandi maksimal 72 byte'),
    })
    .parse(req.body);
  const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: res.locals.admin.id } });
  if (!(await bcrypt.compare(data.currentPassword, admin.passwordHash))) {
    res.status(400).json({ error: 'Kata sandi saat ini salah' });
    return;
  }
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: await bcrypt.hash(data.password, 12) },
    }),
    prisma.adminSession.deleteMany({ where: { adminId: admin.id } }),
  ]);
  res.clearCookie(COOKIE, { path: '/' }).json({ ok: true });
});
