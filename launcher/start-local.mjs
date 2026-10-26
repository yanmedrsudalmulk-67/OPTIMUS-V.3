import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
if (Number(process.versions.node.split('.')[0]) !== 24)
  throw new Error('Gunakan Node.js versi 24.');
const npmCli =
  process.env.npm_execpath ||
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
function npm(args) {
  const result = existsSync(npmCli)
    ? spawnSync(process.execPath, [npmCli, ...args], { stdio: 'inherit' })
    : spawnSync('npm', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Perintah npm gagal: ' + args.join(' '));
}
function openBrowser() {
  const url = 'http://localhost:3005';
  const child =
    process.platform === 'win32'
      ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
  child.on('error', () => console.log('Buka browser pada port 3005.'));
}
async function available(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () =>
      reject(
        new Error(
          `Port ${port} sedang dipakai. Tutup aplikasi game sebelumnya atau aplikasi lain pada port tersebut.`,
        ),
      ),
    );
    server.listen(port, '0.0.0.0', () => server.close(resolve));
  });
}
await available(3005);
await available(4001);
mkdirSync('.data', { recursive: true });
const lockHash = createHash('sha256')
  .update(readFileSync('package-lock.json'))
  .update(process.version)
  .update(process.platform)
  .update(process.arch)
  .digest('hex');
if (
  !existsSync('node_modules/next/package.json') ||
  !existsSync('.data/dependencies') ||
  readFileSync('.data/dependencies', 'utf8') !== lockHash
) {
  npm(['ci']);
  writeFileSync('.data/dependencies', lockHash);
}
npm(['run', 'setup:local']);
const hash = createHash('sha256');
function include(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (['node_modules', '.next', 'uploads'].includes(entry.name)) continue;
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) include(filename);
    else if (!filename.endsWith('.tsbuildinfo'))
      hash.update(filename).update(readFileSync(filename));
  }
}
include('apps');
include('packages');
for (const name of ['package-lock.json', 'tsconfig.json', '.env']) hash.update(readFileSync(name));
const buildHash = hash.digest('hex');
if (
  !existsSync('apps/web/.next/BUILD_ID') ||
  !existsSync('.data/build') ||
  readFileSync('.data/build', 'utf8') !== buildHash
) {
  npm(['run', 'build']);
  writeFileSync('.data/build', buildHash);
}
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'apps/realtime-server/src/index.ts'], {
    stdio: 'inherit',
  }),
  spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      'apps/web',
      '--hostname',
      '0.0.0.0',
      '--port',
      '3005',
    ],
    { stdio: 'inherit' },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500).unref();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 1);
  });
}
for (let i = 0; i < 120 && !stopping; i++) {
  try {
    const api = await fetch('http://127.0.0.1:4001/api/health', {
      signal: AbortSignal.timeout(1000),
    });
    if (!api.ok) throw new Error('API belum siap');
    const response = await fetch('http://127.0.0.1:3005/api/health', {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      console.log(
        'Game siap pada port 3005. Akun: AKUN-ADMIN.txt. Tekan Ctrl+C di jendela ini untuk berhenti.',
      );
      if (process.env.NO_BROWSER !== '1') openBrowser();
      break;
    }
  } catch {}
  if (i === 119) {
    console.error('Aplikasi belum siap. Periksa pesan kesalahan di atas.');
    stop(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
