const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function updateWebp() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const page = await browser.newPage();

  const refPath = 'C:/Users/User/.gemini/antigravity/brain/4c138fcd-13fb-4696-b5ab-0684a960691a/.user_uploaded/media_1795092181787_d722da55.jpg';
  const imgBase64 = fs.readFileSync(refPath).toString('base64');
  const dataUri = `data:image/jpeg;base64,${imgBase64}`;

  const webpData = await page.evaluate(async (uri) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Source image is 1024 x 768.
        // Front view of Bidan Sari:
        // x spans ~100 to ~490 (width ~390), y spans ~40 to ~700 (height ~660).
        // Let's create a 512x512 square avatar centered on Bidan Sari's front pose.
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const sx = 70;
        const sy = 25;
        const sw = 450;
        const sh = 680;

        // Draw scaled to fit 512x512 with slight margin
        const scale = Math.min(500 / sw, 500 / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (512 - dw) / 2;
        const dy = (512 - dh) / 2;

        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        resolve(canvas.toDataURL('image/webp', 0.95));
      };
      img.onerror = reject;
      img.src = uri;
    });
  }, dataUri);

  const base64Data = webpData.replace(/^data:image\/webp;base64,/, '');
  const outPath = path.resolve('apps/web/public/heroes/midwife.webp');
  fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
  console.log('Successfully updated:', outPath, 'Bytes:', fs.statSync(outPath).size);

  await browser.close();
}

updateWebp().catch(console.error);
