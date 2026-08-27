// global-setup.ts — load .env, seed the `zz-` fixtures, then make sure the two
// saved sessions the suite runs on (admin, investor) are valid.
//
// It REUSES a saved session whenever one still works. That is not an
// optimisation: `/login` is rate-limited to 20 attempts per 10 minutes per IP
// (src/server/auth/rate-limit.ts), the whole suite runs from 127.0.0.1, and
// logging in twice on every invocation means a handful of runs in quick
// succession — exactly what iterating on a spec looks like — starts failing
// with the generic "locked" message, which reads like a product bug. Weakening
// the limit for tests was the wrong fix; not spending it is the right one.
import { chromium, type Browser } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { seedE2E } from "./fixtures/seed";
import {
  ADMIN,
  INVESTOR,
  adminStorageState,
  investorStorageState,
  loginAs,
} from "./helpers/login";

/** True when the saved state still gets us past the auth gate. */
async function stateStillValid(
  browser: Browser,
  baseURL: string,
  storageState: string,
  probePath: string,
): Promise<boolean> {
  if (!existsSync(storageState)) return false;
  const context = await browser.newContext({ baseURL, storageState });
  try {
    const page = await context.newPage();
    await page.goto(probePath, { waitUntil: "domcontentloaded" });
    return !new URL(page.url()).pathname.startsWith("/login");
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  await seedE2E();

  mkdirSync("e2e/.auth", { recursive: true });
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  try {
    for (const [who, storageState, probePath] of [
      [ADMIN, adminStorageState, "/dashboard"],
      [INVESTOR, investorStorageState, "/portal/investor"],
    ] as const) {
      if (await stateStillValid(browser, baseURL, storageState, probePath)) continue;
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await loginAs(page, who);
      await context.storageState({ path: storageState });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
