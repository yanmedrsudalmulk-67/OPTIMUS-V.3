import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const globalPrisma = globalThis as unknown as { medicalPrisma?: PrismaClient };
export const prisma =
  globalPrisma.medicalPrisma ??
  new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalPrisma.medicalPrisma = prisma;
export default prisma;
