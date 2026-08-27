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

export const adminStorageState = "e2e/.auth/admin.json";

/** Fill and submit the /login form, waiting for the post-login landing route. */
export async function loginAs(page: Page, who: { email: string; password: string }): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/portal/, { timeout: 60_000 });
}
