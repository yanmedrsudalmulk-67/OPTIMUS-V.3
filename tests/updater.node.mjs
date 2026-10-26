import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { applyUpdate, recoverUpdate, sourcePath } from '../launcher/update-core.mjs';
import { acquireLock } from '../launcher/process-lock.mjs';
const version = 'a'.repeat(40);
const data = (text) => ({ data: Buffer.from(text), mode: '100644' });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'medical updater '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    'package.json': data(JSON.stringify({ name: 'medical-tug-of-war', version: '2.0.0' })),
    'launcher/start-local.mjs': data('// updated launcher'),
    'packages/database/prisma/schema.prisma': data('datasource db { provider = "sqlite" }'),
    'apps/web/app/page.tsx': data('new feature'),
  };
  fs.mkdirSync(path.join(root, 'apps/web/app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/web/app/page.tsx'), 'my local code');
  fs.writeFileSync(
    path.join(root, 'package.json'),
    '{"name":"medical-tug-of-war","version":"1.0.0"}',
  );
  fs.writeFileSync(
    path.join(root, '.env'),
    'DATABASE_URL=file:./medical.db\nADMIN_PASSWORD=private-test-value',
  );
  fs.writeFileSync(path.join(root, 'AKUN-ADMIN.txt'), 'private account');
  fs.mkdirSync(path.join(root, 'apps/realtime-server/uploads'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/realtime-server/uploads/picture.png'), 'image bytes');
  const db = new DatabaseSync(path.join(root, 'medical.db'));
  db.exec(
    "CREATE TABLE scores(name TEXT, score INTEGER); INSERT INTO scores VALUES ('Player', 150)",
  );
  db.close();
  return { root, files };
}
test('update retains database, credentials, uploads and local extras, with recoverable backup of edited source', (t) => {
  const { root, files } = fixture(t);
  fs.writeFileSync(path.join(root, 'my-notes.txt'), 'keep');
  const original = fs.readFileSync(path.join(root, 'medical.db'));
  const backup = applyUpdate(root, files, version);
  assert.equal(fs.readFileSync(path.join(root, 'apps/web/app/page.tsx'), 'utf8'), 'new feature');
  assert.deepEqual(fs.readFileSync(path.join(root, 'medical.db')), original);
  assert.deepEqual(fs.readFileSync(path.join(backup, 'local-data/database')), original);
  assert.equal(
    fs.readFileSync(path.join(backup, 'source/apps/web/app/page.tsx'), 'utf8'),
    'my local code',
  );
  assert.equal(fs.readFileSync(path.join(root, 'AKUN-ADMIN.txt'), 'utf8'), 'private account');
  assert.equal(
    fs.readFileSync(path.join(root, 'apps/realtime-server/uploads/picture.png'), 'utf8'),
    'image bytes',
  );
  assert.equal(fs.readFileSync(path.join(root, 'my-notes.txt'), 'utf8'), 'keep');
  assert.equal(
    fs.readFileSync(path.join(backup, 'local-data/.env'), 'utf8'),
    fs.readFileSync(path.join(root, '.env'), 'utf8'),
  );
  assert.equal(fs.existsSync(path.join(root, '.data/update-pending.json')), false);
});
test('write failure rolls back changed files and removes newly added files', (t) => {
  const { root, files } = fixture(t);
  let writes = 0;
  assert.throws(
    () =>
      applyUpdate(root, files, version, (target, content) => {
        if (++writes === 3) throw new Error('simulated disk failure');
        fs.writeFileSync(target, content);
      }),
    /source sebelumnya telah dipulihkan/,
  );
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '1.0.0');
  assert.equal(fs.readFileSync(path.join(root, 'apps/web/app/page.tsx'), 'utf8'), 'my local code');
  assert.equal(fs.existsSync(path.join(root, 'launcher/start-local.mjs')), false);
  assert.equal(fs.existsSync(path.join(root, '.data/update-pending.json')), false);
});
test('interrupted updates can be recovered on next run without changing database', (t) => {
  const { root, files } = fixture(t);
  const backup = applyUpdate(root, files, version);
  const info = JSON.parse(fs.readFileSync(path.join(backup, 'INFO.json'), 'utf8'));
  fs.writeFileSync(
    path.join(root, '.data/update-pending.json'),
    JSON.stringify({
      backup: path.relative(path.join(root, '.data'), backup).split(path.sep).join('/'),
      entries: info.entries,
    }),
  );
  assert.equal(recoverUpdate(root), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '1.0.0');
  assert.equal(recoverUpdate(root), false);
  const db = new DatabaseSync(path.join(root, 'medical.db'));
  assert.equal(db.prepare('SELECT score FROM scores').get().score, 150);
  db.close();
});
test('protected data, traversal and non-source paths are rejected before changes', (t) => {
  const { root, files } = fixture(t);
  for (const name of [
    '.env',
    '.env.local',
    'medical.db',
    'apps/a.sqlite-wal',
    'AKUN-ADMIN.txt',
    'launcher/local.env',
    'apps/realtime-server/uploads/a.png',
    'apps/../package.json',
    '/package.json',
    'apps\\x.ts',
    'C:/x',
    '.git/config',
    'node_modules/x',
    'unknown.txt',
  ]) {
    assert.equal(sourcePath(name), false, name);
    assert.throws(() => applyUpdate(root, { ...files, [name]: data('bad') }, version));
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version, '1.0.0');
});
test('custom database filename is protected even without a database extension', (t) => {
  const { root, files } = fixture(t);
  fs.writeFileSync(path.join(root, '.env'), 'DATABASE_URL=file:./apps/custom.data');
  fs.writeFileSync(path.join(root, 'apps/custom.data'), 'database');
  assert.throws(
    () => applyUpdate(root, { ...files, 'apps/custom.data': data('bad') }, version),
    /database lokal/,
  );
  assert.equal(fs.readFileSync(path.join(root, 'apps/custom.data'), 'utf8'), 'database');
});
test('incomplete or wrong repository package and case collisions fail before replacement', (t) => {
  const { root, files } = fixture(t);
  assert.throws(
    () => applyUpdate(root, { ...files, 'package.json': data('{"name":"different"}') }, version),
    /bukan game/,
  );
  assert.throws(
    () => applyUpdate(root, { 'package.json': files['package.json'] }, version),
    /bukan game/,
  );
  assert.throws(
    () => applyUpdate(root, { ...files, 'apps/x.ts': data('a'), 'apps/X.ts': data('b') }, version),
    /bertabrakan/,
  );
});
test('symlink targets cannot write outside game folder', (t) => {
  const { root, files } = fixture(t);
  fs.mkdirSync(path.join(root, 'outside'));
  fs.symlinkSync(path.join(root, 'outside'), path.join(root, 'apps/linked'), 'dir');
  assert.throws(
    () => applyUpdate(root, { ...files, 'apps/linked/a.ts': data('bad') }, version),
    /simbolik/,
  );
});
test('application lock blocks concurrent launch/update and releases normally', (t) => {
  const { root } = fixture(t);
  const release = acquireLock(root);
  assert.throws(() => acquireLock(root), /masih berjalan/);
  release();
  const secondRelease = acquireLock(root);
  secondRelease();
  assert.equal(fs.existsSync(path.join(root, '.data/app.lock')), false);
});

test('download pins commit, verifies Git blob hash, and excludes private files and bundled ZIP', async () => {
  const { downloadRelease } = await import('../launcher/update-network.mjs');
  const { createHash } = await import('node:crypto');
  const bytes = Buffer.from('verified source');
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const visited = [];
  const result = await downloadRelease({
    fetcher: async (url, options) => {
      visited.push(url);
      assert.equal(options.headers.Authorization, undefined);
      if (url.includes('/commits/')) return Response.json({ sha: version });
      if (url.includes('/git/trees/')) {
        assert.ok(url.includes(version));
        return Response.json({
          truncated: false,
          tree: [
            {
              type: 'blob',
              path: 'apps/web/app/page.tsx',
              mode: '100644',
              sha,
              size: bytes.length,
            },
            { type: 'blob', path: '.env', mode: '100644' },
            { type: 'blob', path: 'Medical-Tug-SQLite-3005.zip', mode: '100644' },
          ],
        });
      }
      assert.ok(url.startsWith('https://raw.githubusercontent.com/'));
      assert.ok(url.includes(version));
      return new Response(bytes);
    },
  });
  assert.equal(result.version, version);
  assert.deepEqual(Object.keys(result.files), ['apps/web/app/page.tsx']);
  assert.equal(visited.length, 3);
});
test('corrupt or inaccessible downloads fail before an update is returned', async () => {
  const { downloadRelease } = await import('../launcher/update-network.mjs');
  await assert.rejects(
    downloadRelease({ fetcher: async () => new Response('', { status: 404 }) }),
    /GitHub tidak dapat diakses/,
  );
  await assert.rejects(
    downloadRelease({
      fetcher: async (url) => {
        if (url.includes('/commits/')) return Response.json({ sha: version });
        if (url.includes('/git/trees/'))
          return Response.json({
            tree: [
              { type: 'blob', path: 'package.json', mode: '100644', size: 4, sha: 'b'.repeat(40) },
            ],
          });
        return new Response('oops');
      },
    }),
    /Verifikasi file gagal/,
  );
});
