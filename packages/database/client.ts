import 'dotenv/config';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = `file:${path.resolve('packages/database/prisma/dev.db')}`;
}

const globalPrisma = globalThis as unknown as { medicalPrisma?: PrismaClient };
export const prisma =
  globalPrisma.medicalPrisma ??
  new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalPrisma.medicalPrisma = prisma;
export default prisma;
