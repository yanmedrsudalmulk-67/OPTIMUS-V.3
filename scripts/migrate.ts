import 'dotenv/config';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Checked-in Prisma-compatible SQL, applied transactionally without a native CLI engine.
async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(746925813)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_medical_migrations" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const folder = path.resolve('packages/database/prisma/migrations');
    for (const entry of (await readdir(folder, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const sql = await readFile(path.join(folder, entry.name, 'migration.sql'), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await client.query<{ checksum: string }>(
        'SELECT checksum FROM "_medical_migrations" WHERE name=$1',
        [entry.name],
      );
      if (applied.rows.length) {
        if (applied.rows[0].checksum !== checksum)
          throw new Error(`Migrasi ${entry.name} telah berubah setelah diterapkan.`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO "_medical_migrations" (name,checksum) VALUES ($1,$2)', [
        entry.name,
        checksum,
      ]);
      console.log(`Migrasi diterapkan: ${entry.name}`);
    }
    await client.query('COMMIT');
    console.log('Database siap; seluruh migrasi terverifikasi.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Migrasi gagal.');
  process.exitCode = 1;
});
