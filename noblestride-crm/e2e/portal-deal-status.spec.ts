// F6b.3 as amended by G3 — image29/image30.
//
// image29: the milestone checklist "might need to be removed from the investor
// and only show if a deal is open, closed or ongoing; then have the investor add
// comments", and "the investor doesn't need to see the success fee status".
// image30: the finance KPIs should be removed by default, with an admin able to
// turn them back on.
//
// So: a one-word status chip and the comment thread by default, the 14-step
// checklist only when an admin enables it, and "Success fee paid" never — not
// even when it is enabled.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { investorStorageState } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

test.describe("F6b.3 / G3 — the investor sees a deal status, not a 15-step checklist", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    await setSetting("portal.deal.milestones", "false");
    await setSetting("portal.dashboard.financeTiles", "false");
  });

  test.afterAll(async () => {
    // Back to the seeded defaults, which globalTeardown also asserts.
    await setSetting("portal.deal.milestones", "false");
    await setSetting("portal.dashboard.financeTiles", "false");
    await prisma.$disconnect();
  });

  test("by default: a status chip and the conversation, no milestone list", async ({ browser }) => {
    const context = await browser.newContext({ storageState: investorStorageState });
    const page = await context.newPage();

    await test.step("the deal page shows one word for where the deal stands", async () => {
      await page.goto(`/portal/investor/deals/${IDS.transaction}`);
      const chip = page.getByTestId("deal-status-chip");
      await expect(chip).toBeVisible();
      await expect(chip).toHaveText(/^(Open|In progress|Closed)$/);
    });

    await test.step("the milestone checklist is not rendered", async () => {
      await expect(page.getByTestId("deal-milestones")).toHaveCount(0);
      await expect(page.getByText("Success fee paid")).toHaveCount(0);
    });

    await test.step("the investor can still comment — image29's replacement for the checklist", async () => {
      await expect(page.getByRole("heading", { name: /conversation/i })).toBeVisible();
    });

    await test.step("the pipeline drops the stepper too", async () => {
      await page.goto("/portal/investor/pipeline");
      await expect(page.getByTestId(`pipeline-stepper-${IDS.transaction}`)).toHaveCount(0);
      await expect(page.getByTestId(`pipeline-status-${IDS.transaction}`)).toBeVisible();
    });

    await context.close();
  });

  test("an admin can switch the checklist on, and the success fee is still hidden", async ({ page, browser }) => {
    await test.step("the admin toggles portal.deal.milestones under /settings/app", async () => {
      await page.goto("/settings/app");
      await page.getByTestId("setting-portal.deal.milestones").getByRole("switch").click();
      await expect
        .poll(async () =>
          (await prisma.appSetting.findUniqueOrThrow({ where: { key: "portal.deal.milestones" } })).value,
        )
        .toBe("true");
    });

    await test.step("the fund now sees 14 milestones — never 15", async () => {
      const context = await browser.newContext({ storageState: investorStorageState });
      const investorPage = await context.newPage();
      await investorPage.goto(`/portal/investor/deals/${IDS.transaction}`);
      const list = investorPage.getByTestId("deal-milestones");
      await expect(list).toBeVisible();
      await expect(list.locator("li")).toHaveCount(14);
      await expect(investorPage.getByText("Success fee paid")).toHaveCount(0);
      // The status chip stays — the checklist is additive, not a replacement.
      await expect(investorPage.getByTestId("deal-status-chip")).toBeVisible();
      await context.close();
    });

    await test.step("and switching it back off hides it again", async () => {
      await page.goto("/settings/app");
      await page.getByTestId("setting-portal.deal.milestones").getByRole("switch").click();
      await expect
        .poll(async () =>
          (await prisma.appSetting.findUniqueOrThrow({ where: { key: "portal.deal.milestones" } })).value,
        )
        .toBe("false");
    });
  });

  test("image30: no finance tiles by default — an onboarding checklist instead", async ({ browser, page }) => {
    const context = await browser.newContext({ storageState: investorStorageState });
    const investorPage = await context.newPage();

    await test.step("the dashboard leads with what the fund still owes us", async () => {
      await investorPage.goto("/portal/investor/dashboard");
      const stepper = investorPage.getByTestId("portal-onboarding-stepper");
      await expect(stepper).toBeVisible();
      await expect(investorPage.getByTestId("onboarding-step-account")).toHaveAttribute("data-done", "true");
      await expect(investorPage.getByTestId("onboarding-step-nda")).toBeVisible();
      await expect(investorPage.getByTestId("portal-disbursements")).toHaveCount(0);
      await expect(investorPage.getByText("Committed")).toHaveCount(0);
    });

    await test.step("an admin can turn the finance tiles back on", async () => {
      await page.goto("/settings/app");
      await page.getByTestId("setting-portal.dashboard.financeTiles").getByRole("switch").click();
      await expect
        .poll(async () =>
          (await prisma.appSetting.findUniqueOrThrow({ where: { key: "portal.dashboard.financeTiles" } })).value,
        )
        .toBe("true");

      await investorPage.goto("/portal/investor/dashboard");
      await expect(investorPage.getByText("Committed")).toBeVisible();
      await expect(investorPage.getByTestId("portal-disbursements")).toBeVisible();
      // The checklist steps aside once the numbers are shown.
      await expect(investorPage.getByTestId("portal-onboarding-stepper")).toHaveCount(0);
    });

    await test.step("back off again", async () => {
      await page.goto("/settings/app");
      await page.getByTestId("setting-portal.dashboard.financeTiles").getByRole("switch").click();
      await expect
        .poll(async () =>
          (await prisma.appSetting.findUniqueOrThrow({ where: { key: "portal.dashboard.financeTiles" } })).value,
        )
        .toBe("false");
    });

    await context.close();
  });
});
