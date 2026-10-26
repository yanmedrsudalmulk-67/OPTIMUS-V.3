import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { databaseLocation } from './packages/database/location';
export default defineConfig({
  schema: 'packages/database/prisma/schema.prisma',
  experimental: { adapter: true },
  engine: 'js',
  adapter: async () => new PrismaLibSQL({ url: databaseLocation().url }),
  migrations: {
    path: 'packages/database/prisma/migrations',
    seed: 'tsx packages/database/seed.ts',
  },
});
