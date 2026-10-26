import { defineConfig } from '@playwright/test';
import 'dotenv/config';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 240000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: process.env.TEST_WEB_URL || 'http://127.0.0.1:3005',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
    },
  },
});
