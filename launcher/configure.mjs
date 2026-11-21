import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('launcher/local.env')) {
  const db = randomBytes(24).toString('hex');
  const password = randomBytes(18).toString('hex');
  writeFileSync('launcher/local.env', `LOCAL_DB_PASSWORD=${db}\nLOCAL_ADMIN_PASSWORD=${password}\n`, { mode: 0o600 });
  writeFileSync('AKUN-ADMIN.txt', `Akun admin lokal\nUsername: admin\nPassword: ${password}\n\nSimpan file ini secara pribadi. Jangan dibagikan.\n`, { mode: 0o600 });
}
console.log('Konfigurasi siap. Akun login ada di AKUN-ADMIN.txt.');
