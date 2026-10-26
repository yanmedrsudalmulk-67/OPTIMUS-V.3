import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
if (!existsSync('.env')) {
  const password = randomBytes(18).toString('hex');
  writeFileSync(
    '.env',
    `DATABASE_URL=file:./medical.db\nADMIN_USERNAME=admin\nADMIN_PASSWORD=${password}\nAPI_PORT=4001\nWEB_ORIGIN=http://localhost:3005,http://127.0.0.1:3005\nPUBLIC_APP_URL=http://localhost:3005\nCOOKIE_SECURE=false\n`,
    { mode: 0o600 },
  );
}
dotenv.config({ quiet: true });
const { databaseLocation } = await import('../packages/database/location');
databaseLocation();
function run(args: string[]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error('Setup gagal: ' + args.join(' '));
}
run([
  'node_modules/prisma/build/index.js',
  'generate',
  '--schema',
  'packages/database/prisma/schema.prisma',
]);
run(['--import', 'tsx', 'scripts/migrate.ts']);
run(['--import', 'tsx', 'packages/database/seed.ts']);
const { prisma } = await import('../packages/database/client');
try {
  if (!(await prisma.adminUser.count())) run(['--import', 'tsx', 'scripts/create-admin.ts']);
} finally {
  await prisma.$disconnect();
}
if (!existsSync('AKUN-ADMIN.txt') && process.env.ADMIN_PASSWORD) {
  writeFileSync(
    'AKUN-ADMIN.txt',
    `Username: ${process.env.ADMIN_USERNAME}\nPassword: ${process.env.ADMIN_PASSWORD}\nSimpan pribadi.\n`,
    { mode: 0o600 },
  );
}
console.log('Setup selesai. Data tersimpan di medical.db. Jalankan npm run local.');
