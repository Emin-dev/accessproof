import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:18197', browserName: 'chromium', viewport: { width: 1280, height: 900 } },
  webServer: {
    command: 'node server.mjs',
    env: { PORT: '18197' },
    url: 'http://127.0.0.1:18197',
    reuseExistingServer: false,
  },
  reporter: 'list',
});
