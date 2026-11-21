import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = `file:${path.resolve('packages/database/prisma/dev.db')}`;
}

export default defineConfig({
  schema: 'packages/database/prisma/schema.prisma',
  migrations: {
    path: 'packages/database/prisma/migrations',
    seed: 'tsx packages/database/seed.ts',
  },
});
