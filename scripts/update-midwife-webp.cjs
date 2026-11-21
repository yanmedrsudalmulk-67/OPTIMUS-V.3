const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function updateWebp() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  console.log('Opening http://localhost:3000/characters...');
  await page.goto('http://localhost:3000/characters', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Select Bidan Sari
  const midwifeBtn = page.locator('button[aria-label*="Bidan Sari"], button[title*="Bidan Sari"]').first();
  await midwifeBtn.click();
  await page.waitForTimeout(1500);

  // Wait a moment and capture the transparent WebGL canvas cropped to the upper-body bust (head to waist/hands)
  const webpData = await page.evaluate(async () => {
    const srcCanvas = document.querySelector('canvas');
    if (!srcCanvas) throw new Error('No WebGL canvas found');

    // Capture full WebGL canvas first
    const w = srcCanvas.width;
    const h = srcCanvas.height;

    // Create temp canvas to read pixels and find bounding box of non-transparent pixels
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(srcCanvas, 0, 0);

    const imgData = tctx.getImageData(0, 0, w, h).data;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    // Only scan the top 82% of canvas height so we exclude the glowing floor ring at the feet
    const maxScanY = Math.floor(h * 0.80);
    for (let y = 0; y < maxScanY; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = imgData[(y * w + x) * 4 + 3];
        if (alpha > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const charW = maxX - minX;
    const charH = maxY - minY;
    // Upper body bust: from top of head (minY) down to ~74% of character height (just below tunic hem & hands, matching doctor-m.webp & nurse-f.webp)
    const bustH = Math.floor(charH * 0.76);
    const cropSize = Math.max(charW * 1.18, bustH * 1.05);
    const centerX = (minX + maxX) / 2;
    const sx = centerX - cropSize / 2;
    const sy = minY - cropSize * 0.055;

    const out = document.createElement('canvas');
    out.width = 512;
    out.height = 512;
    const ctx = out.getContext('2d');

    // Add subtle soft studio drop shadow like doctor-m.webp / nurse-f.webp
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(srcCanvas, sx, sy, cropSize, cropSize, 0, 0, 512, 512);
    ctx.restore();

    return out.toDataURL('image/webp', 0.96);
  });

  const base64Data = webpData.replace(/^data:image\/webp;base64,/, '');
  const outPath = path.resolve('apps/web/public/heroes/midwife.webp');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  console.log('Successfully updated transparent bust:', outPath, 'Bytes:', fs.statSync(outPath).size);

  await browser.close();
}

updateWebp().catch((err) => {
  console.error(err);
  process.exit(1);
});
