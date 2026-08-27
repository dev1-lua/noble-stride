// clients-filters.spec.ts — F2.2/image3 (newest first + Created column) and
// F6.1/image26 (country, sector, revenue filters), plus the project codename
// and women/youth-led checkboxes on the client form.

import { test, expect } from "@playwright/test";
import { IDS } from "./fixtures/seed";

test.describe.configure({ mode: "serial" });

test.describe("F2.2 / F6.1 — clients newest-first, filterable by date created, country, sector and revenue", () => {
  test("lists newest first with Country and Created columns", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.locator("body")).toContainText("newest first");
    await expect(page.locator("th", { hasText: "Country" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Created" })).toBeVisible();

    // The Kenya fixture is created now; the Uganda one is backdated two days.
    const rows = page.locator("tbody tr");
    const kenyaIndex = await rows.filter({ hasText: "zz-E2E Client (Kenya)" }).first().evaluate((el) => Array.from(el.parentElement!.children).indexOf(el));
    const ugandaIndex = await rows.filter({ hasText: "zz-E2E Client (Uganda)" }).first().evaluate((el) => Array.from(el.parentElement!.children).indexOf(el));
    expect(kenyaIndex).toBeLessThan(ugandaIndex);
  });

  test("filters by country, sector and revenue band", async ({ page }) => {
    await page.goto("/clients");

    await page.getByLabel("Country").click();
    await page.getByRole("option", { name: "Uganda", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("tbody tr", { hasText: "zz-E2E Client (Uganda)" })).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "zz-E2E Client (Kenya)" })).toHaveCount(0);

    await page.reload();
    await page.getByLabel("Sector").click();
    await page.getByRole("option", { name: "Technology", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("tbody tr", { hasText: "zz-E2E Client (Uganda)" })).toBeVisible();

    await page.reload();
    await page.getByLabel("Revenue").click();
    await page.getByRole("option", { name: "< $1M", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("tbody tr", { hasText: "zz-E2E Client (Uganda)" })).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: "zz-E2E Client (Kenya)" })).toHaveCount(0);
  });

  test("search combines with a filter", async ({ page }) => {
    await page.goto("/clients");
    await page.getByPlaceholder("Search clients…").fill("zz-E2E Client");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.getByLabel("Country").click();
    await page.getByRole("option", { name: "Kenya", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr")).toContainText("Kenya");
  });

  test("the client form writes the project codename and the impact checkboxes", async ({ page }) => {
    await page.goto(`/clients/${IDS.clientUganda}`);
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Project Codename").fill("zz-Project Falcon");
    await page.getByLabel("Women-led").check();
    await page.getByLabel("Youth-led").check();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByTestId("client-codename")).toContainText("zz-Project Falcon", { timeout: 30_000 });
    await page.reload();
    await expect(page.getByTestId("client-codename")).toContainText("zz-Project Falcon");
    await expect(page.locator("body")).toContainText("Women-led");
  });
});
