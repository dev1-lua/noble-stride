// retainer.spec.ts — F4.3.1/image18: a mandate's retainer tracks the amount
// paid and the outstanding balance.

import { test, expect } from "@playwright/test";
import { IDS } from "./fixtures/seed";

test.describe.configure({ mode: "serial" });

const MANDATE = `/mandates/${IDS.mandate}`;

test.describe("retainer paid and balance", () => {
  test("the deal summary shows amount, paid and balance", async ({ page }) => {
    await page.goto(MANDATE);
    await expect(page.getByTestId("retainer-amount")).toContainText("$50K");
    const balance = page.getByTestId("retainer-balance");
    await expect(balance).toContainText("Paid");
    await expect(balance).toContainText("Balance");
    await expect(balance).toContainText("$30K");
  });

  test("paying the retainer in full drops the balance to zero", async ({ page }) => {
    await page.goto(MANDATE);
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Retainer Paid").fill("50000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("retainer-balance")).toContainText("Balance $0", { timeout: 30_000 });

    // restore
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Retainer Paid").fill("20000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("retainer-balance")).toContainText("$30K", { timeout: 30_000 });
  });

  test("the deals list can show the balance column for the mandate", async ({ page }) => {
    await page.goto("/deals?q=zz-E2E Mandate&cols=name,paid,balance");
    const row = page.locator("tr", { hasText: "zz-E2E Mandate" });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("deal-balance")).toContainText("$30,000");
  });
});
