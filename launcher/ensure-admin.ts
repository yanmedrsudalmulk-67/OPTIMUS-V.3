import { prisma } from '../packages/database/client';
import { spawnSync } from 'node:child_process';
try {
  if (!(await prisma.adminUser.count())) {
    const result = spawnSync('npm', ['run', 'admin:create'], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Pembuatan akun admin gagal.');
  }
} finally {
  await prisma.$disconnect();
}
