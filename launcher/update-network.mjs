import { createHash } from 'node:crypto';
import { sourcePath } from './update-core.mjs';
export const repository = 'yanmedrsudalmulk-67/OPTIMUS-V.3';
export const branch = 'codex/game-local-launcher';
export async function downloadRelease({ token, fetcher = fetch } = {}) {
  async function request(url, raw = false) {
    const headers = {
      'User-Agent': 'Medical-Tug-Updater',
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
    };
    if (token && new URL(url).hostname === 'api.github.com')
      headers.Authorization = `Bearer ${token}`;
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(45000) });
    if (!response.ok) {
      if ([401, 403, 404].includes(response.status)) {
        const error = new Error(
          `GitHub tidak dapat diakses (HTTP ${response.status}). Pastikan repository/branch tersedia. Untuk repo privat atau batas akses GitHub, gunakan GITHUB_TOKEN dengan izin baca Contents. Token tidak disimpan oleh updater.`,
        );
        error.auth = true;
        throw error;
      }
      throw new Error(
        `Unduhan GitHub gagal (HTTP ${response.status}). Source dan data belum diganti.`,
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 32 * 1024 * 1024)
      throw new Error('File update melampaui batas ukuran 32 MB.');
    return raw ? bytes : JSON.parse(bytes.toString('utf8'));
  }
  const commit = await request(
    `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}`,
  );
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Versi GitHub tidak valid.');
  const tree = await request(
    `https://api.github.com/repos/${repository}/git/trees/${commit.sha}?recursive=1`,
  );
  if (tree.truncated || !Array.isArray(tree.tree))
    throw new Error('Daftar file GitHub tidak lengkap; update dibatalkan.');
  const entries = tree.tree.filter((entry) => entry.type === 'blob' && sourcePath(entry.path));
  if (entries.some((entry) => !['100644', '100755'].includes(entry.mode)))
    throw new Error('Paket memuat link yang tidak didukung.');
  if (entries.reduce((sum, entry) => sum + entry.size, 0) > 256 * 1024 * 1024)
    throw new Error('Paket update terlalu besar.');
  if (
    entries.some(
      (entry) => !Number.isInteger(entry.size) || entry.size < 0 || entry.size > 32 * 1024 * 1024,
    )
  )
    throw new Error('Ukuran file update tidak valid.');
  const files = {};
  let index = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (index < entries.length) {
        const entry = entries[index++];
        const url = token
          ? `https://api.github.com/repos/${repository}/git/blobs/${entry.sha}`
          : `https://raw.githubusercontent.com/${repository}/${commit.sha}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
        const data = await request(url, true);
        const hash = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
        if (hash !== entry.sha || data.length !== entry.size)
          throw new Error('Verifikasi file gagal: ' + entry.path);
        files[entry.path] = { data, mode: entry.mode };
      }
    }),
  );

  return { files, version: commit.sha };
}
