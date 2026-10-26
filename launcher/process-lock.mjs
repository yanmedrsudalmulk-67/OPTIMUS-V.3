import { mkdirSync, openSync, writeFileSync, closeSync, readFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export function acquireLock(root) {
  mkdirSync(path.join(root, '.data'), { recursive: true });
  const filename = path.join(root, '.data', 'app.lock');
  const token = randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = openSync(filename, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let previous;
      try {
        previous = JSON.parse(readFileSync(filename, 'utf8'));
      } catch {}
      if (!Number.isInteger(previous?.pid) || previous.pid < 1)
        throw new Error(
          'Lock aplikasi tidak valid. Tutup semua proses game lalu periksa .data/app.lock.',
        );
      try {
        process.kill(previous.pid, 0);
      } catch (error) {
        if (error.code === 'ESRCH') {
          unlinkSync(filename);
          continue;
        }
      }
      throw new Error('Game atau updater masih berjalan. Tutup jendela game dengan Ctrl+C dahulu.');
    }
    try {
      writeFileSync(fd, JSON.stringify({ pid: process.pid, token }));
    } finally {
      closeSync(fd);
    }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      try {
        if (JSON.parse(readFileSync(filename, 'utf8')).token === token) unlinkSync(filename);
      } catch {}
      process.removeListener('exit', release);
    };
    process.once('exit', release);
    return release;
  }
  throw new Error('Tidak dapat mengunci folder game. Coba lagi setelah semua proses ditutup.');
}
