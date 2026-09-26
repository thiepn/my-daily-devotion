import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ux",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  reporter: [["list"], ["json", { outputFile: "verification/browser.json" }], ...(process.env.CI ? [["html", { open: "never", outputFolder: "playwright-report" }] as const] : [])],
  use: {
    baseURL: "http://127.0.0.1:4173",
    locale: "en-US",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview:ux",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-firefox", testMatch: /(?:core-flow|release-smoke|corrective-release|prayer-journal)\.spec\.ts/, use: { ...devices["Desktop Firefox"], serviceWorkers: "block" } },
    { name: "desktop-webkit", testMatch: /(?:core-flow|release-smoke|corrective-release|prayer-journal)\.spec\.ts/, use: { ...devices["Desktop Safari"], serviceWorkers: "block" } },
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
