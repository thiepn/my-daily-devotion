import { defineConfig, devices } from "@playwright/test";
import { testOrigin, testPreviewCommand } from "./playwright.server";

export default defineConfig({
  testDir: "./tests/ux",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  reporter: [["list"], ["json", { outputFile: process.env.MDD_TEST_REPORT ?? "verification/browser.json" }], ...(process.env.CI ? [["html", { open: "never", outputFolder: "playwright-report" }] as const] : [])],
  use: {
    baseURL: testOrigin,
    locale: "en-US",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: testPreviewCommand,
    url: testOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-firefox", testMatch: /(?:core-flow|release-smoke|corrective-release|prayer-journal|prayer-detail-journal|focused-prayer-journal|metadata-journal|history-journal|writing-journal|data-backup|search-saved-journal|reading-plan-journal|presentation-journal|recovery-foundation|recovery-journal|durable-capture|durable-notes|durable-prayer-editors|durable-prayer-settings|durable-session-answer|durable-directories)\.spec\.ts/, use: { ...devices["Desktop Firefox"], serviceWorkers: "block" } },
    { name: "desktop-webkit", testMatch: /(?:core-flow|release-smoke|corrective-release|prayer-journal|prayer-detail-journal|focused-prayer-journal|metadata-journal|history-journal|writing-journal|data-backup|search-saved-journal|reading-plan-journal|presentation-journal|recovery-foundation|recovery-journal|durable-capture|durable-notes|durable-prayer-editors|durable-prayer-settings|durable-session-answer|durable-directories)\.spec\.ts/, use: { ...devices["Desktop Safari"], serviceWorkers: "block" } },
    {
      name: "desktop-chromium",
      testIgnore: /pwa\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        serviceWorkers: "block",
      },
    },
    {
      name: "mobile-chromium",
      testIgnore: /(?:pwa|accessibility|visual-certification)\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        serviceWorkers: "block",
      },
    },
    {
      name: "offline-pwa",
      testMatch: /pwa\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        serviceWorkers: "allow",
      },
    },
  ],
});
