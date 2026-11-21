const { chromium } = require('playwright');
const path = require('path');

async function capture() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3005/characters...');
  await page.goto('http://localhost:3005/characters', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click on Bidan Sari avatar in the bottom avatar row
  console.log('Selecting Bidan Sari...');
  const midwifeBtn = page.locator('button[title*="Sari"], button[aria-label*="Sari"]').first();
  await midwifeBtn.click();
  await page.waitForTimeout(1500);

  // 1. Capture front 3D preview
  const shot1 = 'C:/Users/User/.gemini/antigravity/brain/4c138fcd-13fb-4696-b5ab-0684a960691a/midwife-front-preview.png';
  await page.screenshot({ path: shot1 });
  console.log('Saved front shot:', shot1);

  // 2. Rotate 3D model slightly to check the side/3-quarter view
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    // Drag horizontally to rotate character
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 180, startY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    const shot2 = 'C:/Users/User/.gemini/antigravity/brain/4c138fcd-13fb-4696-b5ab-0684a960691a/midwife-side-preview.png';
    await page.screenshot({ path: shot2 });
    console.log('Saved side shot:', shot2);

    // Rotate more to inspect the back of the hijab
    await page.mouse.move(startX - 180, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 360, startY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    const shot3 = 'C:/Users/User/.gemini/antigravity/brain/4c138fcd-13fb-4696-b5ab-0684a960691a/midwife-back-preview.png';
    await page.screenshot({ path: shot3 });
    console.log('Saved back shot:', shot3);
  }

  await browser.close();
  console.log('Capture complete!');
}

capture().catch(console.error);
