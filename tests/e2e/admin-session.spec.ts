import { test, expect } from '@playwright/test';
import type { QuestionPackage, RoomState } from '../../packages/shared/src';

test('administrator can log out, log back in, and authorize the existing host socket', async ({
  page,
  request,
}) => {
  const response = await request.post('/api/auth/login', {
    data: { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  const packages = (await (await request.get('/api/packages')).json()) as QuestionPackage[];
  const room = (await (
    await request.post('/api/matches', {
      data: {
        title: `Session QA ${Date.now()}`,
        packageId: packages[0].id,
        teamAName: 'Tim Hijau',
        teamBName: 'Tim Biru',
        settings: { questionCount: 1 },
      },
    })
  ).json()) as RoomState;
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto(`/admin/matches/${room.id}`);
  await page.getByRole('button', { name: 'Kunci lobby', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Buka kunci lobby', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel('Nama pengguna', { exact: true }).fill(process.env.ADMIN_USERNAME!);
  await page.getByLabel('Kata sandi', { exact: true }).fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Masuk ke dashboard' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.goto(`/admin/matches/${room.id}`);
  await page.getByRole('button', { name: 'Buka kunci lobby', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kunci lobby', exact: true })).toBeEnabled();
  const final = (await (await request.get(`/api/rooms/${room.code}`)).json()) as RoomState;
  expect(final.locked).toBe(false);
});
