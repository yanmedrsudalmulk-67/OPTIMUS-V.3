import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import type { QuestionPackage, RoomState } from '../../packages/shared/src';

test('six independent phone browsers play a complete live 3D battle', async ({
  browser,
  request,
  baseURL,
}) => {
  const errors: string[] = [];
  const login = await request.post('/api/auth/login', {
    data: { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const packs = (await (await request.get('/api/packages')).json()) as QuestionPackage[];
  const pack = packs.find((p) => p.questions.filter((q) => q.active).length >= 2)!;
  const question = pack.questions
    .filter((q) => q.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const created = await request.post('/api/matches', {
    data: {
      title: `Browser QA ${Date.now()}`,
      packageId: pack.id,
      teamAName: 'Tim Browser Hijau',
      teamBName: 'Tim Browser Biru',
      settings: {
        questionCount: 1,
        duration: 60,
        countdownSeconds: 1,
        revealSeconds: 2,
        pullSeconds: 2,
        resultSeconds: 1,
        autoClose: true,
        quality: 'LOW',
      },
    },
  });
  expect(created.ok()).toBeTruthy();
  const room = (await created.json()) as RoomState;
  const hostContext = await browser.newContext({ storageState: await request.storageState() });
  const host = await hostContext.newPage();
  host.on('pageerror', (e) => errors.push(e.message));
  await host.goto(`/admin/matches/${room.id}`);
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (let index = 0; index < 6; index++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/join/${room.code}`);
      await page.getByLabel('Nama pemain', { exact: true }).fill(`Hero Browser ${index + 1}`);
      if (index >= 3) await page.getByRole('button', { name: /Tim Browser Biru/ }).click();
      if (index > 0) await page.getByRole('button', { name: 'Karakter berikutnya' }).click();
      await page.getByRole('button', { name: 'Saya siap bertanding' }).click();
      await expect(page).toHaveURL(new RegExp(`/lobby/${room.code}`));
      await expect(page.getByRole('button', { name: /READY/ }).first()).toBeVisible();
    }
    await expect(host.getByRole('button', { name: 'START BATTLE' })).toBeEnabled();
    const before = (await (await request.get(`/api/rooms/${room.code}`)).json()) as RoomState;
    expect(before.players).toHaveLength(6);
    expect(before.players.filter((p) => p.ready)).toHaveLength(6);
    // A reload recovers the exact original slot using the player's token.
    const originalId = before.players.find((p) => p.name === 'Hero Browser 1')!.id;
    await pages[0].reload();
    await expect
      .poll(async () => {
        const s = (await (await request.get(`/api/rooms/${room.code}`)).json()) as RoomState;
        return s.players.find((p) => p.id === originalId)?.connected;
      })
      .toBe(true);
    await host.getByRole('button', { name: 'START BATTLE' }).click();
    for (const page of pages) await expect(page).toHaveURL(new RegExp(`/play/${room.code}`));
    await expect(pages[0].locator('.answer-option').first()).toBeEnabled();
    const active = (await (await request.get(`/api/rooms/${room.code}`)).json()) as RoomState;
    expect(active.correctAnswer).toBeUndefined();
    expect(active.question).not.toHaveProperty('correctAnswer');
    await host.getByRole('button', { name: 'Jeda pertandingan', exact: true }).click();
    await expect(pages[0].getByText('Pertandingan dijeda', { exact: true })).toBeVisible();
    await expect(pages[0].locator('.answer-option').first()).toBeDisabled();
    await host.getByRole('button', { name: 'Lanjutkan pertandingan', exact: true }).click();
    for (let index = 0; index < 6; index++) {
      const answer = index < 3 ? question.correctAnswer : (question.correctAnswer + 1) % 4;
      await pages[index].locator('.answer-option').nth(answer).click();
      if (index === 0) {
        await expect(pages[index].getByText('ANSWER SUBMITTED', { exact: true })).toBeVisible();
        await expect(pages[index].locator('.answer-option').first()).toBeDisabled();
      }
    }
    await expect
      .poll(
        async () =>
          ((await (await request.get(`/api/rooms/${room.code}`)).json()) as RoomState).phase,
        { timeout: 20000 },
      )
      .toBe('FINISHED');
    const finished = (await (await request.get(`/api/rooms/${room.code}`)).json()) as RoomState;
    expect(finished.winner).toBe('A');
    expect(finished.ropePosition).toBe(-45);
    expect(finished.rounds).toHaveLength(1);
    expect(
      finished.players
        .filter((p) => p.team === 'A')
        .every((p) => p.correctCount === 1 && p.power === 10),
    ).toBe(true);
    await expect(pages[0].getByText('VICTORY!', { exact: true })).toBeVisible();
    const display = await hostContext.newPage();
    display.on('pageerror', (e) => errors.push(e.message));
    await display.goto(`/display/${room.code}`);
    await expect(display.locator('canvas')).toBeVisible();
    await expect(display.getByText('Tim Browser Hijau', { exact: true }).first()).toBeVisible();
    await display.screenshot({ path: 'test-results/battle-display.png', fullPage: true });
    await pages[0].screenshot({ path: 'test-results/player-result.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
    await hostContext.close();
  }
});

test('welcome arena and mobile join navigation are interactive', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Fantasy Battlefield', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fantasy Battlefield', exact: true })).toHaveClass(
    'selected',
  );
  await page.getByLabel('KODE ROOM', { exact: true }).fill('TEST42');
  await page.getByRole('button', { name: 'Masuk arena', exact: true }).click();
  await expect(page).toHaveURL(/\/join\/TEST42/);
  await expect(page.locator('.error-message[role="alert"]')).toBeVisible();
});
