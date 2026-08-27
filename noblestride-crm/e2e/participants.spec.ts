// F6b.4 — "the investor should be able to add the onboarded members of their
// team as participants of a deal. The members need to be onboarded into the
// system for this to happen." (feedback §6b text 4 / image31.)
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { investorStorageState } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

test.describe("F6b.4 — the investor adds onboarded colleagues as deal participants", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    await prisma.engagementParticipant.deleteMany({ where: { engagementId: IDS.engagement } });
  });
  test.afterAll(async () => {
    await prisma.engagementParticipant.deleteMany({ where: { engagementId: IDS.engagement } });
    await prisma.$disconnect();
  });

  test("only colleagues with portal access are offered, and adding one works", async ({ browser, page }) => {
    const context = await browser.newContext({ storageState: investorStorageState });
    const investorPage = await context.newPage();

    await test.step("the deal page offers the fund's own roster", async () => {
      await investorPage.goto(`/portal/investor/deals/${IDS.transaction}`);
      const card = investorPage.getByTestId("participants-card");
      await expect(card).toContainText("They must already have portal access");
      await expect(card).toContainText("No participants yet");
    });

    await test.step("the colleague WITHOUT portal access is not offered at all", async () => {
      const options = await investorPage.getByTestId("participant-select").locator("option").allInnerTexts();
      expect(options.join(" | ")).toContain("zz-E2E Colleague");
      // image31's constraint, enforced by omission rather than by an error.
      expect(options.join(" | ")).not.toContain("Not Onboarded");
    });

    await test.step("adding the onboarded colleague works", async () => {
      await investorPage
        .getByTestId("participant-select")
        .selectOption(IDS.investorColleague);
      await investorPage.getByTestId("add-participant").click();
      await expect(investorPage.getByTestId("participant-notice")).toContainText("they can see this deal");
      await expect(investorPage.getByTestId("participant-row")).toHaveCount(1);

      const row = await prisma.engagementParticipant.findFirstOrThrow({
        where: { engagementId: IDS.engagement },
      });
      expect(row.personId).toBe(IDS.investorColleague);
    });

    await test.step("staff see the roster on the engagement, read-only", async () => {
      await page.goto(`/engagement/${IDS.engagement}#participants`);
      await expect(page.getByTestId("staff-participants")).toContainText("zz-E2E Colleague");
      // Staff have no add control — participants are the fund's own roster.
      await expect(page.getByTestId("add-participant")).toHaveCount(0);
    });

    await test.step("removing the colleague works", async () => {
      await investorPage.goto(`/portal/investor/deals/${IDS.transaction}`);
      await investorPage.getByTestId(`remove-participant-${IDS.investorColleague}`).click();
      await expect(investorPage.getByTestId("participant-notice")).toContainText("Removed from this deal");
      expect(await prisma.engagementParticipant.count({ where: { engagementId: IDS.engagement } })).toBe(0);
    });

    await context.close();
  });

  test("'Only deals I follow' filters the pipeline for a participant", async ({ browser }) => {
    // The primary contact follows everything by definition, so the meaningful
    // case is the colleague — who follows nothing until added.
    await prisma.engagementParticipant.deleteMany({ where: { engagementId: IDS.engagement } });

    const context = await browser.newContext({ storageState: investorStorageState });
    const page = await context.newPage();

    await test.step("the primary contact sees the fund's whole pipeline under either tab", async () => {
      await page.goto("/portal/investor/pipeline");
      const all = await page.locator('a[href^="/portal/investor/deals/"]').count();
      expect(all).toBeGreaterThan(0);
      await page.getByTestId("pipeline-tab-mine").click();
      await expect(page).toHaveURL(/mine=1/);
      await expect(page.locator('a[href^="/portal/investor/deals/"]')).toHaveCount(all);
    });

    await test.step("a participant chip appears once they are on the deal", async () => {
      // Add the PRIMARY contact explicitly so the chip has something to show.
      await prisma.engagementParticipant.create({
        data: { engagementId: IDS.engagement, personId: IDS.investorPerson },
      });
      await page.goto("/portal/investor/pipeline");
      await expect(page.getByTestId("participant-chip").first()).toContainText("I follow this");
      await prisma.engagementParticipant.deleteMany({ where: { engagementId: IDS.engagement } });
    });

    await context.close();
  });
});
