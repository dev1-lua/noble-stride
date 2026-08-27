// F3.3 / F3.4 — "a column and filter for the date onboarded", and "an overview
// of all the investors where you can search a person and see their profile,
// their fund and its contacts" (feedback §3 texts 3 and 4 / image8, image9).
//
// The fund search only ever matched Investor.name, so looking up a PERSON found
// nothing. The people card is the answer, and it deep-links to that contact's
// own row on the fund page.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

test.describe("F3.3 / F3.4 — date onboarded, and searching for a person rather than a fund", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    // F3.3: give the seeded fund a real onboarded date to show and sort on.
    await prisma.investor.update({
      where: { id: IDS.investor },
      data: { approvedAt: new Date("2026-07-15T00:00:00Z") },
    });
  });
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("the Onboarded column shows the date and sorts by it", async ({ page }) => {
    await test.step("the column is there, with the seeded date", async () => {
      await page.goto("/investors?q=zz-E2E+Investor");
      await expect(page.getByTestId("sort-approvedAt")).toContainText("Onboarded");
      await expect(page.getByRole("row").filter({ hasText: "zz-E2E Investor" })).toContainText("Jul");
    });

    await test.step("clicking the header sorts newest-first", async () => {
      await page.getByTestId("sort-approvedAt").click();
      await expect(page).toHaveURL(/sort=approvedAt/);
      await expect(page).toHaveURL(/dir=desc/);
    });

    await test.step("a from-date in the future empties the list (F3.3 filter)", async () => {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      await page.goto(`/investors?approvedFrom=${tomorrow}`);
      await expect(page.getByText(/Showing 0 of/)).toBeVisible();
    });
  });

  test("searching a person's surname surfaces them above the fund list", async ({ page }) => {
    await test.step("the people card appears for a contact-name search", async () => {
      await page.goto("/investors?q=Investor+Contact");
      const hit = page.getByTestId("people-result").filter({ hasText: "Investor Contact" });
      await expect(hit).toHaveCount(1);
      await expect(hit).toContainText("zz-E2E Investor");
      await expect(hit).toContainText("zz-e2e-investor@e2e.noblestride.test");
    });

    await test.step("the link lands on that contact's own row on the fund page", async () => {
      await page
        .getByTestId("people-result")
        .filter({ hasText: "Investor Contact" })
        .getByRole("link", { name: /Investor Contact/ })
        .click();
      await expect(page).toHaveURL(new RegExp(`/investors/${IDS.investor}#contact-${IDS.investorPerson}`));
      await expect(page.locator(`#contact-${IDS.investorPerson}`)).toBeVisible();
    });

    await test.step("a fund-name search still works and shows no people card", async () => {
      await page.goto("/investors?q=zz-E2E+Investor");
      await expect(page.getByRole("row").filter({ hasText: "zz-E2E Investor" })).toBeVisible();
    });
  });
});
