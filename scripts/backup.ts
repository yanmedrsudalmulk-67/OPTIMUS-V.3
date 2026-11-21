import 'dotenv/config';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
mkdirSync('.data', { recursive: true, mode: 0o700 });
const result = spawnSync(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_dump',
    '--no-owner',
    '--no-acl',
    '-U',
    process.env.POSTGRES_USER || 'medical',
    '-d',
    process.env.POSTGRES_DB || 'medical',
  ],
  { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 },
);
if (result.status !== 0) {
  console.error('Backup gagal. Periksa status PostgreSQL.');
  process.exitCode = 1;
} else {
  writeFileSync('.data/database-snapshot.sql.tmp', result.stdout, { mode: 0o600 });
  renameSync('.data/database-snapshot.sql.tmp', '.data/database-snapshot.sql');
  console.log(
    'Backup tersimpan di .data/database-snapshot.sql. Simpan dengan aman; file ini memuat data pertandingan.',
  );
}
