// 🤖 playwright.config.js
// Playwright E2E 測試設定
// 對應 [TESTING_PLAN.md §5.3](./TESTING_PLAN.md)

'use strict'

const { defineConfig } = require('@playwright/test')

/**
 * @type {import('@playwright/test').PlaywrightTestConfig}
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'cmd /c "set CORS_ORIGINS=https://sm.yuang093.cc,http://localhost:3001,http://localhost:3000&& npm start"',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})