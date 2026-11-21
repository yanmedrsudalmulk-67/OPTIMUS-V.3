import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('original audio honors gesture, music, volume, sound, mute and cleanup', async ({ page }) => {
  const source = readFileSync('apps/web/lib/audio.ts', 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  await page.setContent('<button>Aktifkan audio</button>');
  await page.evaluate(() => {
    const browser = window as any;
    const Native = window.AudioContext;
    browser.audioProbe = { contexts: [], gains: [], oscillators: 0, buffers: 0, activeSources: 0 };
    browser.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        browser.audioProbe.contexts.push(this);
      }
      createGain() {
        const gain = super.createGain();
        browser.audioProbe.gains.push(gain);
        return gain;
      }
      createOscillator() {
        browser.audioProbe.oscillators++;
        const source = super.createOscillator();
        browser.audioProbe.activeSources++;
        source.addEventListener('ended', () => browser.audioProbe.activeSources--);
        return source;
      }
      createBufferSource() {
        browser.audioProbe.buffers++;
        browser.audioProbe.activeSources++;
        const source = super.createBufferSource();
        source.addEventListener('ended', () => browser.audioProbe.activeSources--);
        return source;
      }
    };
  });
  await page.addScriptTag({
    content: `(()=>{const exports={};${javascript};window.testAudio=exports;})();`,
  });
  await page.evaluate(() =>
    (window as any).testAudio.configureAudio({ sound: true, music: true, volume: 0.35 }),
  );
  expect(await page.evaluate(() => (window as any).audioProbe.contexts.length)).toBe(0);
  await page.getByRole('button', { name: 'Aktifkan audio' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).audioProbe.contexts[0]?.state))
    .toBe('running');
  await page.evaluate(() => {
    const browser = window as any;
    browser.audioAnalyser = browser.audioProbe.contexts[0].createAnalyser();
    browser.audioAnalyser.fftSize = 2048;
    browser.audioProbe.gains[0].connect(browser.audioAnalyser);
  });
  const energy = () =>
    page.evaluate(() => {
      const analyser = (window as any).audioAnalyser as AnalyserNode;
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    });
  await expect.poll(energy).toBeGreaterThan(0.00001);
  expect(await page.evaluate(() => (window as any).audioProbe.buffers)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).audioProbe.gains[0].gain.value)).toBeCloseTo(
    0.35,
    2,
  );
  await page.evaluate(() => (window as any).testAudio.setMuted(true));
  await expect.poll(energy).toBeLessThan(0.00001);
  await page.evaluate(() => {
    const audio = (window as any).testAudio;
    audio.setMuted(false);
    audio.configureAudio({ music: false, sound: false, volume: 0.2 });
  });
  const countBefore = await page.evaluate(() => (window as any).audioProbe.oscillators);
  await page.evaluate(() => (window as any).testAudio.playSound('correct'));
  expect(await page.evaluate(() => (window as any).audioProbe.oscillators)).toBe(countBefore);
  await page.evaluate(() => {
    const audio = (window as any).testAudio;
    audio.configureAudio({ sound: true });
    audio.playSound('correct');
  });
  expect(await page.evaluate(() => (window as any).audioProbe.oscillators)).toBe(countBefore + 3);
  const crowdBefore = await page.evaluate(() => (window as any).audioProbe.buffers);
  await page.evaluate(() => (window as any).testAudio.playSound('victory'));
  expect(await page.evaluate(() => (window as any).audioProbe.buffers)).toBeGreaterThan(
    crowdBefore,
  );
  await page.evaluate(() => {
    const audio = (window as any).testAudio;
    audio.configureAudio({ music: true });
    audio.stopMusic();
  });
  const countStopped = await page.evaluate(() => (window as any).audioProbe.oscillators);
  await page.waitForTimeout(550);
  expect(await page.evaluate(() => (window as any).audioProbe.oscillators)).toBe(countStopped);
  await expect.poll(() => page.evaluate(() => (window as any).audioProbe.activeSources)).toBe(0);
  await expect.poll(energy).toBeLessThan(0.00001);
});
