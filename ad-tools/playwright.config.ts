import { defineConfig } from '@playwright/test';

// Films the advert scenes from the app build that serve-app.mjs serves.
export default defineConfig({
  testDir: __dirname,
  testMatch: 'record-scenes.spec.ts',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
});
