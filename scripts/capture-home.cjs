const { chromium } = require('playwright');

async function capture() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await chromium.launch({ executablePath: edgePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3005...');
  await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const shotPath = 'C:/Users/User/.gemini/antigravity/brain/4c138fcd-13fb-4696-b5ab-0684a960691a/home-after-card.png';
  await page.screenshot({ path: shotPath });
  console.log('Saved after shot to:', shotPath);
  await browser.close();
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
