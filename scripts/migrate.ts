import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { databaseLocation } from '../packages/database/location';
const { filename } = databaseLocation();
mkdirSync(path.dirname(filename), { recursive: true });
const db = new DatabaseSync(filename);
try {
  db.exec(
    'PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000; PRAGMA journal_mode=DELETE; BEGIN IMMEDIATE',
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS "_medical_migrations" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  const folder = path.resolve('packages/database/prisma/migrations');
  for (const entry of readdirSync(folder, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const sql = readFileSync(path.join(folder, entry.name, 'migration.sql'), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const applied = db
      .prepare('SELECT checksum FROM "_medical_migrations" WHERE name=?')
      .get(entry.name);
    if (applied) {
      if (applied.checksum !== checksum)
        throw new Error(`Migrasi ${entry.name} berubah setelah diterapkan.`);
      continue;
    }
    db.exec(sql);
    db.prepare('INSERT INTO "_medical_migrations" (name,checksum) VALUES (?,?)').run(
      entry.name,
      checksum,
    );
  }
  db.exec('COMMIT');
  console.log('Database SQLite siap:', filename);
} catch (error) {
  if (db.isTransaction) db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
