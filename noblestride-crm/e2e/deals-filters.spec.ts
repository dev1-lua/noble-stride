// deals-filters.spec.ts — F4.1.4/image16: the crowded filter bar becomes
// Search · Type · Status · Lead · More filters, with chips for what is active.

import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("deals filter bar", () => {
  test("only the primary controls are on the bar; the rest live behind More filters", async ({ page }) => {
    await page.goto("/deals");
    await expect(page.getByTestId("deals-search")).toBeVisible();
    await expect(page.getByLabel("Filter by type")).toBeVisible();
    await expect(page.getByLabel("Filter by status")).toBeVisible();
    await expect(page.getByLabel("Filter by lead")).toBeVisible();
    await expect(page.getByTestId("deals-more-filters")).toBeVisible();

    // Secondary filters are NOT on the bar until the popover is opened.
    await expect(page.getByLabel("Sector")).toHaveCount(0);
    await page.getByTestId("deals-more-filters").click();
    await expect(page.getByLabel("Sector")).toBeVisible();
    await expect(page.getByLabel("Classification")).toBeVisible();
    await expect(page.getByLabel("Group by")).toBeVisible();
  });

  test("a filter shows as a removable chip and narrows the list", async ({ page }) => {
    await page.goto("/deals?type=advisory");
    await expect(page).toHaveURL(/type=advisory/);
    const chip = page.getByTestId("deals-chip-type-advisory");
    await expect(chip).toContainText("Type: Advisory");

    await chip.click();
    await expect(page).not.toHaveURL(/type=advisory/, { timeout: 30_000 });
    await expect(page.getByTestId("deals-chip-type-advisory")).toHaveCount(0);
  });

  test("Clear all drops every filter but keeps the display params", async ({ page }) => {
    await page.goto("/deals?type=advisory&classification=Valuation&cols=name,company,balance");
    await expect(page.getByTestId("deals-chip-classification-Valuation")).toContainText("Classification: Valuation");
    await expect(page.getByTestId("deals-more-filters")).toContainText("1");

    await page.getByTestId("deals-clear-all").click();
    await expect(page.getByTestId("deals-active-filters")).toHaveCount(0, { timeout: 30_000 });
    await expect(page).toHaveURL(/cols=name%2Ccompany%2Cbalance|cols=name,company,balance/);
  });

  test("the classification filter matches the seeded advisory and shows fee columns", async ({ page }) => {
    await page.goto("/deals?type=advisory&classification=Valuation&cols=name,company,classification,paid,balance");
    const row = page.locator("tr", { hasText: "zz-E2E Advisory" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Valuation");
    await expect(row).toContainText("$2,500");
    await expect(row.getByTestId("deal-balance")).toContainText("$7,500");
  });

  test("Columns chooser toggles a column, and the Views popover saves the current view", async ({ page }) => {
    await page.goto("/deals");
    await page.getByTestId("deals-columns").click();
    // .click(), not .check(): toggling a column pushes a new URL, so the RSC
    // re-renders and the popover unmounts — the checkbox never flips in place.
    await page.getByTestId("deals-col-classification").click();
    await expect(page).toHaveURL(/cols=/, { timeout: 30_000 });
    await expect(page.locator("th", { hasText: "Classification" })).toBeVisible();

    // The popover stays open (so several columns can be toggled); dismiss it
    // before reaching for another control — its click-catcher swallows the
    // first outside click, exactly as it does for a real user.
    await page.keyboard.press("Escape");
    await page.getByTestId("deals-views").click();
    page.once("dialog", (d) => d.accept("zz-view"));
    await page.getByTestId("deals-save-view").click();
    await page.reload();
    await page.getByTestId("deals-views").click();
    await expect(page.getByLabel("Saved views")).toContainText("zz-view", { timeout: 30_000 });
    await page.keyboard.press("Escape");
  });

  test("the Board toggle and Group by still work", async ({ page }) => {
    await page.goto("/deals");
    await page.getByRole("button", { name: "Board", exact: true }).click();
    await expect(page).toHaveURL(/view=board/, { timeout: 30_000 });
    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page).not.toHaveURL(/view=board/, { timeout: 30_000 });

    await page.getByTestId("deals-more-filters").click();
    await page.getByLabel("Group by").selectOption("lead");
    await expect(page).toHaveURL(/group=lead/, { timeout: 30_000 });
    await page.keyboard.press("Escape");
  });

  test("sorting by balance is accepted", async ({ page }) => {
    await page.goto("/deals?sort=balance&dir=desc&cols=name,paid,balance");
    await expect(page.locator("th", { hasText: "Balance" })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});
