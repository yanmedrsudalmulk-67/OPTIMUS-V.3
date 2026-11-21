import { readFileSync } from 'node:fs';
import { downloadRelease, repository, branch } from './update-network.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { acquireLock } from './process-lock.mjs';
import { applyUpdate, recoverUpdate } from './update-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
let release;
async function vacant(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () =>
      reject(
        new Error(
          `Port ${port} masih dipakai. Tutup game dengan Ctrl+C dahulu, lalu ulangi update.`,
        ),
      ),
    );
    server.listen(port, '0.0.0.0', () => server.close(resolve));
  });
}

try {
  let localPackage;
  try {
    localPackage = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {}
  if (localPackage?.name !== 'medical-tug-of-war')
    throw new Error(
      'Letakkan UPDATE-GAME.bat dan folder launcher di folder game yang berisi package.json dan medical.db.',
    );
  release = acquireLock(root);
  await vacant(3005);
  await vacant(4001);
  if (recoverUpdate(root)) console.log('Update yang terputus sebelumnya telah dipulihkan.');
  console.log(`Mengambil update dari ${repository}, branch ${branch}...`);
  const { files, version } = await downloadRelease({ token });
  console.log(
    'Unduhan terverifikasi. Mencadangkan source dan data lokal sebelum memasang update...',
  );
  const backup = applyUpdate(root, files, version);
  console.log(
    `Update berhasil: ${version.slice(0, 7)}.\nBackup: ${backup}\nDatabase, akun, dan uploads tetap dipertahankan. Buka kembali shortcut game agar dependensi/build diperbarui.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = error.auth ? 3 : 1;
} finally {
  release?.();
}
