import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const allowedRoots = new Set([
  'apps',
  'packages',
  'launcher',
  'scripts',
  'tests',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
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
  'UPDATE-DARI-GITHUB.bat',
  'PUSH-KE-GITHUB.bat',
  'HENTIKAN-WINDOWS.bat',
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
    name.includes('//')
  )
    return false;
  const segments = name.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..')) return false;
  if (segments.some((part) => protectedParts.has(part))) return false;
  const top = segments[0];
  if (allowedRoots.has(top)) return true;
  if (segments.length === 1 && (top.endsWith('.md') || top.endsWith('.txt'))) return true;
  return false;
}

function safeTarget(root, relative) {
  if (!sourcePath(relative)) throw new Error('Path update ditolak: ' + relative);
  const normalized = path.normalize(relative);
  if (path.isAbsolute(normalized) || normalized.startsWith('..'))
    throw new Error('Path tidak aman: ' + relative);
  const resolved = path.resolve(root, normalized);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep))
    throw new Error('Target keluar dari direktori game: ' + relative);
  return resolved;
}

export function applyUpdate(root, files, version = 'unknown') {
  const database = path.resolve(root, 'packages/database/prisma/medical.db');
  const manifest = path.join(root, '.data/update-manifest.json');
  if (fs.existsSync(manifest)) {
    try {
      const prior = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      if (prior.inProgress) throw new Error('Update sebelumnya belum tuntas dipulihkan.');
    } catch (e) {
      if (!e.message.includes('belum tuntas')) throw e;
    }
  }
  const names = Object.keys(files);
  if (names.length === 0) throw new Error('Paket update kosong.');
  for (const name of names) {
    if (!sourcePath(name)) throw new Error('File tidak diizinkan dalam paket: ' + name);
  }
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
    (!files['launcher/start-local.mjs'] && !files['launcher/start-windows.ps1'] && !files['MULAI-WINDOWS.bat']) ||
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
  if (fs.existsSync(uploads)) {
    fs.mkdirSync(path.join(backup, 'local-data/uploads'), { recursive: true });
    for (const f of fs.readdirSync(uploads)) {
      const src = path.join(uploads, f);
      if (fs.statSync(src).isFile())
        fs.copyFileSync(src, path.join(backup, 'local-data/uploads', f));
    }
  }
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(
    manifest,
    JSON.stringify(
      { inProgress: true, backupRelative: relative, date: new Date().toISOString(), version },
      null,
      2,
    ),
  );
  try {
    for (const name of names) {
      const target = safeTarget(root, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, files[name].data);
    }
    fs.writeFileSync(
      manifest,
      JSON.stringify(
        { inProgress: false, backupRelative: relative, date: new Date().toISOString(), version },
        null,
        2,
      ),
    );
  } catch (error) {
    try {
      for (const entry of entries) {
        const target = safeTarget(root, entry.name);
        const saved = path.join(backup, 'source', entry.name);
        if (entry.existed && fs.existsSync(saved)) {
          fs.copyFileSync(saved, target);
        } else if (!entry.existed && fs.existsSync(target)) {
          fs.rmSync(target, { force: true });
        }
      }
      fs.writeFileSync(
        manifest,
        JSON.stringify(
          {
            inProgress: false,
            backupRelative: relative,
            rolledBack: true,
            error: error.message,
            date: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } catch (rollbackError) {
      throw new Error(
        'Update terhenti dan pemulihan belum selesai. Jalankan UPDATE-GAME.bat lagi. Backup: ' +
          backup +
          '. Detail: ' +
          rollbackError.message,
      );
    }
    throw error;
  }
  return backup;
}

export function recoverUpdate(root) {
  const manifest = path.join(root, '.data/update-manifest.json');
  if (!fs.existsSync(manifest)) return false;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  } catch {
    return false;
  }
  if (!data.inProgress || !data.backupRelative) return false;
  const backup = path.join(root, '.data', data.backupRelative, 'source');
  if (!fs.existsSync(backup)) return false;
  function restore(dir, relative = '') {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const rel = path.join(relative, item).replace(/\\/g, '/');
      if (fs.statSync(full).isDirectory()) restore(full, rel);
      else {
        const target = safeTarget(root, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(full, target);
      }
    }
  }
  restore(backup);
  fs.writeFileSync(manifest, JSON.stringify({ ...data, inProgress: false, recovered: true }, null, 2));
  return true;
}
