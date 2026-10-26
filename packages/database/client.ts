import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { databaseLocation } from './location';

const globalPrisma = globalThis as unknown as { medicalPrisma?: PrismaClient };
export const prisma =
  globalPrisma.medicalPrisma ??
  new PrismaClient({
    adapter: new PrismaLibSQL({ url: databaseLocation().url }),
  });
if (process.env.NODE_ENV !== 'production') globalPrisma.medicalPrisma = prisma;
export default prisma;
