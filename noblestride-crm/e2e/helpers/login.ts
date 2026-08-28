// login.ts — shared credentials + a form login helper for the e2e suite.
import type { Page } from "@playwright/test";

export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "E2e!Passw0rd-2026";

export const ADMIN = {
  email: "zz-e2e-admin@e2e.noblestride.test",
  password: E2E_PASSWORD,
};

export const MEMBER = {
  email: "zz-e2e-member@e2e.noblestride.test",
  password: E2E_PASSWORD,
};

/** The seeded investor-portal Editor (F3.1/F3.2/F6b specs). */
export const INVESTOR = {
  email: "zz-e2e-investor@e2e.noblestride.test",
  password: E2E_PASSWORD,
};

/** The seeded partner-portal contact (F5.6). */
export const PARTNER = {
  email: "zz-e2e-partner@e2e.noblestride.test",
  password: E2E_PASSWORD,
};

export const adminStorageState = "e2e/.auth/admin.json";

/**
 * A saved investor-portal session, written once by globalSetup.
 *
 * Specs use this instead of logging in per context because `/login` is
 * rate-limited to 20 attempts per 10 minutes per IP, and the whole suite runs
 * from 127.0.0.1 — a spec that opens a fresh context per step burns through the
 * bucket and then fails with the generic "locked" message, which reads like a
 * product bug. Exactly one spec (nda-clickwrap) still logs in for real, because
 * signing in is part of what it demonstrates.
 */
export const investorStorageState = "e2e/.auth/investor.json";

/** Specs that sign in as somebody else must start from a clean context. */
export const EMPTY_STORAGE = { cookies: [], origins: [] };

/** Fill and submit the /login form, waiting for the post-login landing route. */
export async function loginAs(page: Page, who: { email: string; password: string }): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/portal/, { timeout: 60_000 });
}
