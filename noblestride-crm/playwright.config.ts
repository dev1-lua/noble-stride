// playwright.config.ts — e2e suite for the Aug-2026 feedback work.
// Runs against the LOCAL dev server and the restored-dump database, so:
//   * workers: 1 / fullyParallel: false — specs share one DB and one admin
//     storageState, and several assert counts that a parallel spec could move.
//   * every fixture row is `zz-` prefixed and removed by globalTeardown.
// Never point E2E_BASE_URL at production: the specs write data.
//
// WATCHABLE MODE — `npm run test:e2e:watch` (or E2E_HEADED=1):
// runs in a visible browser and slows each action down so the whole sweep reads
// as a walkthrough of the client's feedback. Every spec names the feedback item
// it proves in its describe block and narrates itself with test.step(), so the
// headed run is the demo. E2E_SLOWMO overrides the pace (default 400 ms).

import { defineConfig, devices } from "@playwright/test";

const headed = process.env.E2E_HEADED === "1";
const slowMo = Number(process.env.E2E_SLOWMO ?? (headed ? 400 : 0));

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  // A slowed-down headed run needs a much longer per-test budget.
  timeout: headed ? 300_000 : 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Signed in as the seeded zz- admin (written by globalSetup).
    storageState: "e2e/.auth/admin.json",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: !headed,
        launchOptions: slowMo > 0 ? { slowMo } : {},
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    // Next 16's first compile of a cold route is slow.
    timeout: 180_000,
  },
});
