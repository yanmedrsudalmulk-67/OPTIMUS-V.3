import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalPrisma = globalThis as unknown as { medicalPrisma?: PrismaClient };
export const prisma =
  globalPrisma.medicalPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
if (process.env.NODE_ENV !== 'production') globalPrisma.medicalPrisma = prisma;
export default prisma;
