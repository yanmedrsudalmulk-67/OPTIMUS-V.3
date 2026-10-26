import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const roots = new Set(['apps', 'packages', 'scripts', 'launcher', 'tests']);
const rootFiles = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'prisma.config.ts',
  'playwright.config.ts',
  'vitest.config.ts',
  '.env.example',
  '.gitignore',
  '.npmrc',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc.json',
  'README.md',
  'VALIDATION.md',
  'CONTRACT.md',
  'BACA-DULU.txt',
  'MULAI-WINDOWS.bat',
  'MULAI-MAC.command',
  'UPDATE-GAME.bat',
]);
const protectedParts = new Set([
  '.git',
  '.data',
  '.runtime',
  'node_modules',
  '.next',
  '.npm-cache',
  'uploads',
  'test-results',
  'playwright-report',
  'coverage',
]);
export function sourcePath(name) {
  if (
    typeof name !== 'string' ||
    name.includes('\\') ||
    name.includes(':') ||
    name.startsWith('/') ||
    name.includes('\0')
  )
    return false;
  const parts = name.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || protectedParts.has(p.toLowerCase())))
    return false;
  const last = parts.at(-1).toLowerCase();
  if (
    (last.startsWith('.env') && name !== '.env.example') ||
    last === 'akun-admin.txt' ||
    last.endsWith('.env') ||
    /\.(db|sqlite|sqlite3)(-|$)|\.(zip|log|tsbuildinfo)$/i.test(last)
  )
    return false;
  return parts.length === 1 ? rootFiles.has(name) : roots.has(parts[0]);
}
function safeTarget(root, name) {
  if (!sourcePath(name)) throw new Error('Lokasi source tidak diizinkan: ' + name);
  let target = root;
  for (const part of name.split('/')) {
    target = path.join(target, part);
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())
      throw new Error('Link simbolik tidak boleh diperbarui: ' + name);
  }
  return target;
}
export function localDatabase(root) {
  let value = process.env.DATABASE_URL;
  if (!value && fs.existsSync(path.join(root, '.env'))) {
    const line = fs
      .readFileSync(path.join(root, '.env'), 'utf8')
      .match(/^\s*DATABASE_URL\s*=\s*(.*?)\s*$/m);
    value = line?.[1]?.replace(/^(['"])(.*)\1$/, '$2');
  }
  value ||= 'file:./medical.db';
  if (!value.startsWith('file:'))
    throw new Error('Updater ini hanya untuk game SQLite. Konfigurasi database lama tidak diubah.');
  return value.startsWith('file://') ? fileURLToPath(value) : path.resolve(root, value.slice(5));
}
const pendingName = '.data/update-pending.json';
export function recoverUpdate(root) {
  const pending = path.join(root, pendingName);
  if (!fs.existsSync(pending)) return false;
  const record = JSON.parse(fs.readFileSync(pending, 'utf8'));
  if (!/^update-backups\/[A-Za-z0-9-]+$/.test(record.backup))
    throw new Error('Catatan pemulihan tidak valid. Periksa .data/update-pending.json.');
  const backup = path.join(root, '.data', record.backup);
  for (const entry of record.entries) {
    const target = safeTarget(root, entry.name);
    if (entry.existed) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(backup, 'source', entry.name), target);
    } else if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  fs.rmSync(path.join(root, '.data/installed-version.txt'), { force: true });
  fs.unlinkSync(pending);
  return true;
}
export function applyUpdate(root, files, version, write = fs.writeFileSync) {
  if (!/^[a-f0-9]{40}$/.test(version)) throw new Error('Versi GitHub tidak valid.');
  if (fs.existsSync(path.join(root, pendingName)))
    throw new Error('Selesaikan pemulihan update sebelumnya dahulu.');
  const names = Object.keys(files);
  const database = path.resolve(localDatabase(root));
  const seen = new Set();
  for (const name of names) {
    const target = safeTarget(root, name);
    if (seen.has(name.toLowerCase())) throw new Error('Nama file bertabrakan pada Windows.');
    seen.add(name.toLowerCase());
    if (
      ['', '-wal', '-shm', '-journal'].some(
        (suffix) => path.resolve(target).toLowerCase() === (database + suffix).toLowerCase(),
      )
    )
      throw new Error('Source bertabrakan dengan database lokal.');
    if (fs.existsSync(target) && !fs.statSync(target).isFile())
      throw new Error('Target bukan file: ' + name);
  }
  const pkg = JSON.parse(files['package.json']?.data?.toString() || '{}');
  if (
    pkg.name !== 'medical-tug-of-war' ||
    !files['launcher/start-local.mjs'] ||
    !files['packages/database/prisma/schema.prisma'] ||
    !/provider\s*=\s*"sqlite"/.test(files['packages/database/prisma/schema.prisma'].data.toString())
  )
    throw new Error('Paket GitHub bukan game SQLite yang lengkap.');
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID();
  const relative = 'update-backups/' + id;
  const backup = path.join(root, '.data', relative);
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
  const entries = names.map((name) => ({ name, existed: fs.existsSync(path.join(root, name)) }));
  // Finish all backups before any source is replaced.
  for (const entry of entries.filter((e) => e.existed)) {
    const destination = path.join(backup, 'source', entry.name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, entry.name), destination);
  }
  const dataFiles = [
    'AKUN-ADMIN.txt',
    ...fs.readdirSync(root).filter((n) => n.startsWith('.env') && n !== '.env.example'),
  ];
  for (const name of dataFiles) {
    const source = path.join(root, name);
    if (fs.existsSync(source)) {
      fs.mkdirSync(path.join(backup, 'local-data'), { recursive: true });
      fs.copyFileSync(source, path.join(backup, 'local-data', name));
    }
  }
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    if (fs.existsSync(database + suffix)) {
      fs.mkdirSync(path.join(backup, 'local-data'), { recursive: true });
      fs.copyFileSync(database + suffix, path.join(backup, 'local-data', 'database' + suffix));
    }
  }
  const uploads = path.join(root, 'apps/realtime-server/uploads');
  if (fs.existsSync(uploads))
    fs.cpSync(uploads, path.join(backup, 'local-data/uploads'), { recursive: true });
  fs.writeFileSync(
    path.join(backup, 'INFO.json'),
    JSON.stringify({ version, database, entries }, null, 2),
  );
  const pending = path.join(root, pendingName);
  fs.writeFileSync(pending + '.tmp', JSON.stringify({ backup: relative, entries }), {
    mode: 0o600,
  });
  fs.renameSync(pending + '.tmp', pending);
  try {
    for (const name of names) {
      const target = safeTarget(root, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      write(target, files[name].data);
      if (process.platform !== 'win32')
        fs.chmodSync(target, files[name].mode === '100755' ? 0o755 : 0o644);
    }
    fs.writeFileSync(path.join(root, '.data/installed-version.txt'), version + '\n');
    fs.unlinkSync(pending);
  } catch (error) {
    try {
      recoverUpdate(root);
    } catch {
      throw new Error(
        'Update terhenti dan pemulihan belum selesai. Jalankan UPDATE-GAME.bat lagi. Backup: ' +
          backup,
      );
    }
    throw new Error('Update gagal; source sebelumnya telah dipulihkan. ' + error.message);
  }
  return backup;
}
