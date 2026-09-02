// retainer.spec.ts — F4.3.1/image18: a mandate's retainer tracks the amount
// paid and the outstanding balance.

import { test, expect } from "@playwright/test";
import { IDS } from "./fixtures/seed";

test.describe.configure({ mode: "serial" });

const MANDATE = `/mandates/${IDS.mandate}`;

test.describe("F4.3.1 — retainer amount, amount paid and the pending balance", () => {
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

  // F4.3.1 third clause: the ledger of individual payments behind the paid amount.
  test("logging an individual payment adds a ledger row and moves the balance", async ({ page }) => {
    await page.goto(MANDATE);
    const card = page.getByTestId("retainer-payments");
    await expect(card).toBeVisible();
    await expect(card).toContainText("No individual payments recorded yet");

    await card.getByLabel("Amount").fill("10000");
    await card.getByLabel("Reference (optional)").fill("INV-042 · bank transfer");
    await card.getByRole("button", { name: "Log payment" }).click();

    const paymentRow = card.getByTestId("retainer-payment-row");
    await expect(paymentRow).toHaveCount(1, { timeout: 30_000 });
    await expect(paymentRow).toContainText("$10K");
    await expect(paymentRow).toContainText("INV-042");
    await expect(card.getByTestId("retainer-payments-total")).toContainText("1 payment · $10K recorded");
    // The Deal Summary's paid/balance re-derive from the incremented paid amount.
    await expect(page.getByTestId("retainer-balance")).toContainText("Paid $30K");
    await expect(page.getByTestId("retainer-balance")).toContainText("Balance $20K");
  });

  test("deleting the payment restores the paid amount and the balance", async ({ page }) => {
    await page.goto(MANDATE);
    const card = page.getByTestId("retainer-payments");
    await card.getByRole("button", { name: /^Delete payment of/ }).click();

    await expect(card.getByTestId("retainer-payment-row")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId("retainer-balance")).toContainText("Paid $20K");
    await expect(page.getByTestId("retainer-balance")).toContainText("Balance $30K");
  });
});
