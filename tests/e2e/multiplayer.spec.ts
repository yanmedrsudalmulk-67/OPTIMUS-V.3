import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { CHARACTERS, type QuestionPackage, type RoomState } from '../../packages/shared/src';

async function editName(page: Page, label: string, value: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(value);
  await page
    .locator('form')
    .filter({ has: input })
    .getByRole('button', { name: 'Simpan', exact: true })
    .click();
  await expect(input).toHaveCount(0);
}

function gameplay(state: RoomState) {
  return {
    phase: state.phase,
    deadlineAt: state.deadlineAt,
    questionId: state.question?.id,
    questionIndex: state.questionIndex,
    ropePosition: state.ropePosition,
    rounds: state.rounds,
    teams: Object.values(state.teams).map(
      ({ id, score, power, answered, correctCount, characters }) => ({
        id,
        score,
        power,
        answered,
        correctCount,
        slots: characters.map(({ slot, characterId }) => ({ slot, characterId })),
      }),
    ),
    players: state.players.map(({ id, score, power, answered }) => ({
      id,
      score,
      power,
      answered,
    })),
  };
}

test('two controllers configure six heroes, rename live teams and complete a battle', async ({
  browser,
  request,
}) => {
  const errors: string[] = [];
  const login = await request.post('/api/auth/login', {
    data: { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const packs = (await (await request.get('/api/packages')).json()) as QuestionPackage[];
  const pack = packs.find((p) => p.questions.some((q) => q.active))!;
  const question = pack.questions
    .filter((q) => q.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const created = await request.post('/api/matches', {
    data: {
      title: `Two controller browser QA ${Date.now()}`,
      packageId: pack.id,
      teamAName: 'Tim Browser Hijau',
      teamBName: 'Tim Browser Biru',
      settings: {
        questionCount: 1,
        duration: 300,
        countdownSeconds: 1,
        revealSeconds: 1,
        pullSeconds: 1,
        resultSeconds: 1,
        autoClose: true,
        quality: 'LOW',
        cameraMotion: false,
      },
    },
  });
  expect(created.ok()).toBeTruthy();
  const room = (await created.json()) as RoomState;
  const state = async () =>
    (await (await request.get(`/api/rooms/${room.code}`)).json()) as RoomState;
  const hostContext = await browser.newContext({
    storageState: await request.storageState(),
    viewport: { width: 1280, height: 900 },
  });
  const host = await hostContext.newPage();
  host.on('pageerror', (e) => errors.push(e.message));
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    await host.goto(`/admin/matches/${room.id}`);
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({
        viewport: { width: i === 0 ? 1280 : 390, height: i === 0 ? 900 : 844 },
        isMobile: i === 1,
        hasTouch: i === 1,
      });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/join/${room.code}`);
      if (i === 1)
        await page.getByRole('button', { name: 'Kendalikan · TEAM BLUE', exact: true }).click();
      await expect(page.getByRole('button', { name: 'START BATTLE', exact: true })).toHaveCount(0);
      const other = page.getByRole('region', {
        name: i === 0 ? 'TEAM BLUE' : 'TEAM GREEN',
        exact: true,
      });
      await expect(other.getByRole('button', { name: /^Edit nama/ })).toHaveCount(0);
      await expect(other.getByRole('button', { name: /Ganti karakter/ })).toHaveCount(0);
      await page.getByRole('button', { name: 'KONFIRMASI TIM & READY', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/lobby/${room.code}`));
      await expect(page.getByRole('button', { name: 'BATALKAN READY', exact: true })).toBeVisible();
    }
    const [green, blue] = pages;
    await editName(green, 'Edit nama pemain slot 1 Green', 'Dr. Andi');
    const originalHero = (await state()).teams.A.characters[0].characterId;
    await green.getByRole('button', { name: 'Ganti karakter slot 1', exact: true }).click();
    let gallery = green.getByRole('dialog', { name: 'Pilih hero · Slot 1', exact: true });
    await expect(gallery).toBeVisible();
    await gallery.getByRole('button', { name: 'Halaman karakter berikutnya', exact: true }).click();
    const surgeon = CHARACTERS.find((c) => c.id === 'surgeon')!;
    await gallery
      .getByRole('button', { name: `${surgeon.name}, ${surgeon.profession}`, exact: true })
      .click();
    await expect(gallery.locator('[data-testid="character-preview"]')).toHaveAttribute(
      'data-character-id',
      'surgeon',
    );
    await gallery.getByRole('button', { name: 'Tutup galeri', exact: true }).click();
    expect((await state()).teams.A.characters[0]).toEqual({
      slot: 0,
      characterId: originalHero,
      name: 'Dr. Andi',
    });
    await green.getByRole('button', { name: 'Ganti karakter slot 1', exact: true }).click();
    gallery = green.getByRole('dialog', { name: 'Pilih hero · Slot 1', exact: true });
    await gallery.getByRole('button', { name: 'Halaman karakter berikutnya', exact: true }).click();
    await gallery
      .getByRole('button', { name: `${surgeon.name}, ${surgeon.profession}`, exact: true })
      .click();
    await gallery.getByRole('button', { name: 'PILIH KARAKTER', exact: true }).click();
    await expect(gallery).toHaveCount(0);
    await expect
      .poll(async () => (await state()).teams.A.characters[0])
      .toEqual({ slot: 0, characterId: 'surgeon', name: 'Dr. Andi' });
    await expect(
      blue
        .getByRole('region', { name: 'TEAM GREEN', exact: true })
        .getByText('Dr. Andi', { exact: true }),
    ).toBeVisible();
    // Reconnect must restore identity only, rather than overwrite this edited roster
    // with the initial selection retained in localStorage.
    const beforeReload = await state();
    await green.reload();
    await expect(green.getByRole('button', { name: 'TIM SAYA SIAP', exact: true })).toBeEnabled();
    await expect
      .poll(async () => (await state()).teams.A.characters)
      .toEqual(beforeReload.teams.A.characters);
    expect((await state()).teams.A.id).toBe(beforeReload.teams.A.id);
    await green.getByRole('button', { name: 'TIM SAYA SIAP', exact: true }).click();
    await expect(host.getByRole('button', { name: 'START BATTLE', exact: true })).toBeEnabled();
    const ready = await state();
    expect(Object.values(ready.teams).filter((t) => t.connected && t.ready)).toHaveLength(2);
    expect(ready.players).toHaveLength(6);
    await host.getByRole('button', { name: 'START BATTLE', exact: true }).click();
    for (const page of pages) await expect(page).toHaveURL(new RegExp(`/play/${room.code}`));
    expect(await blue.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(green.locator('.option-btn').first()).toBeEnabled();
    const active = await state();
    expect(active.correctAnswer).toBeUndefined();
    expect(active.question).not.toHaveProperty('correctAnswer');
    await green.locator('.option-btn').nth(question.correctAnswer).click();
    await expect.poll(async () => (await state()).teams.A.answered).toBe(true);
    const submitted = await state();
    await green.getByRole('button', { name: 'Edit nama tim & hero', exact: true }).click();
    await expect(green.getByRole('button', { name: /Ganti karakter/ })).toHaveCount(0);
    await expect(
      green.getByRole('button', { name: 'Edit nama tim Blue', exact: true }),
    ).toHaveCount(0);
    await editName(green, 'Edit nama tim Green', 'Infection Fighters');
    await editName(green, 'Edit nama pemain slot 1 Green', 'Dr. Andi Live');
    await green.getByRole('button', { name: 'KEMBALI KE GAME', exact: true }).click();
    const renamed = await state();
    expect(renamed.teamAName).toBe('Infection Fighters');
    expect(renamed.players[0].name).toBe('Dr. Andi Live');
    expect(gameplay(renamed)).toEqual(gameplay(submitted));
    await expect(blue.locator('.hud-team-a strong')).toHaveText('Infection Fighters');
    await expect(green.locator('.option-btn').first()).toBeDisabled();
    await green.reload();
    await expect(green.locator('.option-btn').first()).toBeDisabled();
    await expect.poll(async () => (await state()).teams.A.connected).toBe(true);
    expect((await state()).teams.A.characters[0].name).toBe('Dr. Andi Live');
    expect((await state()).teams.A.answered).toBe(true);
    await blue
      .locator('.option-btn')
      .nth((question.correctAnswer + 1) % 4)
      .click({ timeout: 15000 });
    await expect.poll(async () => (await state()).phase, { timeout: 30000 }).toBe('FINISHED');
    const finished = await state();
    expect(finished.winner).toBe('A');
    expect(finished.ropePosition).toBe(-15);
    expect(finished.rounds).toHaveLength(1);
    expect(finished.teams.A.correctCount).toBe(1);
    expect(finished.teams.A.power).toBe(10);
    expect(finished.teams.B.correctCount).toBe(0);
    await expect(green.getByText('VICTORY!', { exact: true })).toBeVisible();
    await expect(
      green.locator('.game-results').getByText('Dr. Andi Live', { exact: true }),
    ).toBeVisible();
    const display = await hostContext.newPage();
    display.on('pageerror', (e) => errors.push(e.message));
    await display.goto(`/display/${room.code}`);
    await expect(display.locator('canvas')).toBeVisible();
    await expect(display.getByText('Infection Fighters', { exact: true }).first()).toBeVisible();
    await expect(display.getByText('Dr. Andi Live', { exact: true }).first()).toBeVisible();
    await display.screenshot({ path: 'test-results/two-team-display.png', fullPage: true });
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
