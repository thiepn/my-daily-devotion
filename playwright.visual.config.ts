import { defineConfig, devices } from '@playwright/test';
import { testOrigin, testPreviewCommand } from './playwright.server';

// Keep OS/browser rasterization stable. Cross-platform behavior is covered by
// playwright.config.ts; these candidate images are reviewed on Windows Chromium.
if (process.platform !== 'win32' && !process.argv.includes('--list')) throw new Error('Image baselines run on Windows. Use the visual CI job on other hosts.');

export default defineConfig({
  testDir: './tests/visual',
  snapshotPathTemplate: '{testDir}/baselines/{arg}{ext}',
  timeout: 45_000,
  workers: 1,
  retries: 0,
  failOnFlakyTests: true,
  expect: { timeout: 8_000, toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: .005, threshold: .15 } },
  reporter: [['list'], ['json', { outputFile: process.env.MDD_TEST_REPORT ?? 'verification/visual.json' }], ['html', { open: 'never', outputFolder: 'visual-report' }]],
  use: { ...devices['Desktop Chrome'], baseURL: testOrigin, locale: 'en-US', timezoneId: 'Europe/Berlin', serviceWorkers: 'block', colorScheme: 'light', reducedMotion: 'reduce', trace: 'retain-on-failure' },
  webServer: { command: testPreviewCommand, url: testOrigin, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
