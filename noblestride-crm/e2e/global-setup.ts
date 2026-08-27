// global-setup.ts — load .env, seed the `zz-` fixtures, then log the admin in
// once and save the storageState every spec reuses.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { seedE2E } from "./fixtures/seed";
import { ADMIN, adminStorageState, loginAs } from "./helpers/login";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  await seedE2E();

  mkdirSync("e2e/.auth", { recursive: true });
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  try {
    await loginAs(page, ADMIN);
    await page.context().storageState({ path: adminStorageState });
  } finally {
    await browser.close();
  }
}
