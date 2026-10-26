import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export function databaseLocation(value = process.env.DATABASE_URL || 'file:./medical.db') {
  if (!value.startsWith('file:'))
    throw new Error(
      'DATABASE_URL harus SQLite lokal (file:./medical.db). Migrasikan konfigurasi PostgreSQL lama dahulu.',
    );
  const filename = value.startsWith('file://')
    ? fileURLToPath(value)
    : path.resolve(value.slice(5));
  return { filename, url: pathToFileURL(filename).href };
}
