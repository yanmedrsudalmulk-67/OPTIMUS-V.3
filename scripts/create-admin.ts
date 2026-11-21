import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../packages/database/client';

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !/^[A-Za-z0-9_.-]{3,64}$/.test(username)) {
    throw new Error(
      'ADMIN_USERNAME wajib diisi (3–64 huruf, angka, titik, garis bawah, atau tanda hubung).',
    );
  }
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(
      'ADMIN_PASSWORD wajib diisi, minimal 12 karakter dan maksimal 72 byte. Masukkan melalui environment; jangan simpan di source code.',
    );
  }
  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing && process.env.ADMIN_REPLACE !== 'true') {
    throw new Error(
      'Administrator sudah ada. Untuk merotasi password secara sengaja gunakan ADMIN_REPLACE=true.',
    );
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.upsert({
      where: { username },
      update: { passwordHash },
      create: { username, passwordHash },
    });
    await tx.adminSession.deleteMany({ where: { adminId: admin.id } });
  });
  console.log('Akun administrator berhasil disimpan. Password tidak ditampilkan.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Gagal membuat administrator.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
