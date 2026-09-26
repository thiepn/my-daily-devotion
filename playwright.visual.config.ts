import { defineConfig, devices } from '@playwright/test';

// Keep OS/browser rasterization stable. Cross-platform behavior is covered by
// playwright.config.ts; these candidate images are reviewed on Windows Chromium.
if (process.platform !== 'win32') throw new Error('Image baselines run on Windows. Use the visual CI job on other hosts.');

export default defineConfig({
  testDir: './tests/visual',
  snapshotPathTemplate: '{testDir}/baselines/{arg}{ext}',
  timeout: 45_000,
  workers: 1,
  retries: 0,
  failOnFlakyTests: true,
  expect: { timeout: 8_000, toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: .005, threshold: .15 } },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'visual-report' }]],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173', locale: 'en-US', timezoneId: 'Europe/Berlin', serviceWorkers: 'block', colorScheme: 'light', reducedMotion: 'reduce', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview:ux', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
