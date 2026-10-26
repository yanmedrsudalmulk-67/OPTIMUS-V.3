import 'dotenv/config';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { databaseLocation } from '../packages/database/location';
mkdirSync('.data', { recursive: true, mode: 0o700 });
const db = new DatabaseSync(databaseLocation().filename, { readOnly: true });
try {
  const destination = `.data/medical-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  await backup(db, destination);
  console.log('Backup SQLite tersimpan:', destination);
} finally {
  db.close();
}
