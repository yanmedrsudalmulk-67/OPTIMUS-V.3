import { test, expect } from '@playwright/test';
import { CHARACTERS } from '../../packages/shared/src';

test('gallery selects stable hero profiles, paginates ten professions and works on mobile', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/characters');
  await expect(page.getByRole('heading', { name: 'CHARACTER GALLERY', exact: true })).toBeVisible();
  await expect(page.locator('.cg-hero-card')).toHaveCount(6);
  await expect(page.locator('canvas')).toBeVisible();
  const nurse = CHARACTERS.find((c) => c.id === 'nurse-f')!;
  await expect(page.getByRole('progressbar', { name: 'Care', exact: true })).toHaveAttribute(
    'aria-valuenow',
    String(nurse.attributes.care),
  );
  const pharmacist = CHARACTERS.find((c) => c.id === 'pharmacist')!;
  await page
    .getByRole('button', { name: `${pharmacist.name}, ${pharmacist.profession}`, exact: true })
    .click();
  await expect(page.locator('[data-testid="character-preview"]')).toHaveAttribute(
    'data-character-id',
    pharmacist.id,
  );
  for (const [key, value] of Object.entries(pharmacist.attributes)) {
    await expect(page.getByRole('progressbar', { name: key, exact: false })).toHaveAttribute(
      'aria-valuenow',
      String(value),
    );
  }
  await page.getByRole('button', { name: 'Halaman karakter berikutnya', exact: true }).click();
  await expect(page.locator('.cg-hero-card')).toHaveCount(4);
  const radiographer = CHARACTERS.find((c) => c.id === 'radiographer')!;
  await page
    .getByRole('button', { name: `${radiographer.name}, ${radiographer.profession}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'PILIH KARAKTER', exact: true }).click();
  await expect(page.getByRole('button', { name: 'HERO TERPILIH', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('medical:preferredHero'))).toBe(
    'radiographer',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', {
      name: `${radiographer.name}, ${radiographer.profession}`,
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const imagesLoaded = await page
    .locator('.cg-hero-card img')
    .evaluateAll((images) =>
      images.every(
        (image) =>
          (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
      ),
    );
  expect(imagesLoaded).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-testid="character-preview"]')).toHaveAttribute(
    'data-character-id',
    'radiographer',
  );
  expect(errors).toEqual([]);
});
