import { defineConfig } from '@playwright/test';
import { baseURL } from './tests/helpers/test-app';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results',
  workers: 1,
  timeout: 45_000,
  use: { baseURL, headless: true, trace: 'retain-on-failure', ignoreHTTPSErrors: baseURL.startsWith('https:') },
});
