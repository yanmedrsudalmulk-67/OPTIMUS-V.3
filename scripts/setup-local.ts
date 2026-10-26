import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { Pool } from 'pg';

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} gagal.`);
}
async function main() {
  if (!existsSync('.env')) {
    const dbPassword = randomBytes(24).toString('hex');
    writeFileSync(
      '.env',
      `DATABASE_URL=postgresql://medical:${dbPassword}@127.0.0.1:5432/medical?schema=public\nPOSTGRES_USER=medical\nPOSTGRES_PASSWORD=${dbPassword}\nPOSTGRES_DB=medical\nADMIN_USERNAME=admin\nADMIN_PASSWORD=${randomBytes(24).toString('base64url')}\nAPI_PORT=4001\nWEB_ORIGIN=http://localhost:3000,http://127.0.0.1:3000\nPUBLIC_APP_URL=http://localhost:3000\n`,
      { mode: 0o600 },
    );
    console.log('Konfigurasi lokal dibuat di .env (diabaikan Git). Kredensial tidak ditampilkan.');
  }
  dotenv.config({ quiet: true });
  run('docker', ['compose', 'up', '-d', 'postgres']);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await pool.query('SELECT 1');
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!ready)
    throw new Error(
      'PostgreSQL belum siap setelah 15 detik. Periksa docker compose logs postgres.',
    );
  const tables = await pool.query<{ table: string | null }>(
    `SELECT to_regclass('public."Match"')::text AS "table"`,
  );
  if (!tables.rows[0].table && existsSync('.data/database-snapshot.sql')) {
    console.log('Memulihkan snapshot database lokal…');
    const restored = spawnSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'postgres',
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        process.env.POSTGRES_USER || 'medical',
        '-d',
        process.env.POSTGRES_DB || 'medical',
      ],
      { input: readFileSync('.data/database-snapshot.sql'), stdio: ['pipe', 'ignore', 'inherit'] },
    );
    if (restored.status !== 0)
      throw new Error('Pemulihan snapshot gagal; database tidak direset otomatis.');
  }
  await pool.end();
  run('npm', ['run', 'db:setup']);
  const { prisma } = await import('../packages/database/client');
  const count = await prisma.adminUser.count();
  await prisma.$disconnect();
  if (!count) run('npm', ['run', 'admin:create']);
  mkdirSync('.data', { recursive: true, mode: 0o700 });
  console.log(
    'Setup selesai. Jalankan npm run dev. Gunakan akun dalam .env atau rotasikan dengan ADMIN_REPLACE=true npm run admin:create.',
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Setup gagal.');
  process.exitCode = 1;
});
