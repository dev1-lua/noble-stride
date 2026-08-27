// global-setup.ts — load .env, seed the `zz-` fixtures, then log the admin in
// once and save the storageState every spec reuses.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { seedE2E } from "./fixtures/seed";
import { ADMIN, INVESTOR, adminStorageState, investorStorageState, loginAs } from "./helpers/login";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  await seedE2E();

  mkdirSync("e2e/.auth", { recursive: true });
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  try {
    // Two saved sessions, both written once. /login is rate-limited per IP
    // (20 / 10 min), so specs must not log in for themselves — see the note on
    // investorStorageState in helpers/login.ts.
    for (const [who, path] of [
      [ADMIN, adminStorageState],
      [INVESTOR, investorStorageState],
    ] as const) {
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      await loginAs(page, who);
      await context.storageState({ path });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
