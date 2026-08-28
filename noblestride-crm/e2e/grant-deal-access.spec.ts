// F6b.2 — "restrict the details until the investor has expressed interest and
// been granted access" (feedback §6b text 2 / image28).
//
// The whole point of this spec is the refusal. Decision D2: the client's wording
// implies detail should unmask the moment interest arrives, and SOW §06 forbids
// that without an NDA. Grant-deal-access therefore refuses with copy pointing at
// the NDA flow, and only works once the NDA exists — which is what makes the
// click-wrap NDA from F3.2 the unblocker rather than a weakened guard.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { investorStorageState } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

/** The seeded engagement, back at "interest registered, nothing granted". */
async function resetToInterestReceived(): Promise<void> {
  await prisma.eSignEnvelope.deleteMany({ where: { investorId: IDS.investor } });
  await prisma.document.deleteMany({ where: { investorId: IDS.investor, type: "NDA" } });
  await prisma.investor.update({
    where: { id: IDS.investor },
    data: { ndaStatus: "None", openNdaSignedAt: null },
  });
  await prisma.stageChange.deleteMany({ where: { engagementId: IDS.engagement } });
  await prisma.engagement.update({
    where: { id: IDS.engagement },
    data: {
      engagementStage: "Shared",
      status: "Interested",
      ndaType: null,
      ndaSignedAt: null,
      accessGrantedAt: null,
      accessGrantedById: null,
    },
  });
}

test.describe("F6b.2 — deal detail stays restricted until interest is registered AND access is granted", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    await resetToInterestReceived();
  });
  test.afterAll(async () => {
    await resetToInterestReceived();
    await prisma.$disconnect();
  });

  test("the investor is told their interest is being reviewed, not left guessing", async ({ browser }) => {
    const context = await browser.newContext({ storageState: investorStorageState });
    const page = await context.newPage();

    await test.step("the pipeline row reads 'Awaiting access'", async () => {
      await page.goto("/portal/investor/pipeline");
      const chip = page.getByTestId(`pipeline-status-${IDS.transaction}`);
      await expect(chip).toHaveText("Awaiting access");
    });

    await test.step("the deal page explains why detail is still withheld", async () => {
      await page.goto(`/portal/investor/deals/${IDS.transaction}`);
      const banner = page.getByTestId("interest-received-banner");
      await expect(banner).toContainText("Interest received");
      await expect(banner).toContainText("unlocks once access is granted");
      // Financials are still banded, not raw.
      await expect(page.getByText("Revenue (range)")).toBeVisible();
    });

    await context.close();
  });

  test("staff cannot grant access without an NDA, and the refusal says what to do", async ({ page }) => {
    await resetToInterestReceived();
    await page.goto(`/engagement/${IDS.engagement}`);

    await test.step("the engagement shows the amber 'Awaiting access grant' state", async () => {
      await expect(page.getByText("Awaiting access grant")).toBeVisible();
    });

    await test.step("the deal page flags the investor as awaiting a grant", async () => {
      await page.goto(`/transactions/${IDS.transaction}#engagements`);
      await expect(page.getByTestId(`awaiting-access-${IDS.engagement}`)).toBeVisible();
      await page.goto(`/engagement/${IDS.engagement}`);
    });

    await test.step("Grant deal access is refused, pointing at the portal NDA flow", async () => {
      await page.getByTestId("grant-deal-access").click();
      const error = page.getByTestId("grant-deal-access-error");
      await expect(error).toContainText("no signed NDA yet");
      await expect(error).toContainText("Portal → NDA");
    });

    await test.step("nothing moved — the guard is not advisory", async () => {
      const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: IDS.engagement } });
      expect(engagement.engagementStage).toBe("Shared");
      expect(engagement.accessGrantedAt).toBeNull();
    });
  });

  test("once the NDA is signed, granting access unmasks the deal for the investor", async ({ browser, page }) => {
    await resetToInterestReceived();

    await test.step("the fund signs the Noblestride NDA in its portal", async () => {
      const context = await browser.newContext({ storageState: investorStorageState });
      const investorPage = await context.newPage();
      await investorPage.goto("/portal/investor/nda");
      const canvas = investorPage.getByTestId("sig-canvas");
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      if (!box) throw new Error("signature canvas has no box");
      await investorPage.mouse.move(box.x + 40, box.y + box.height / 2);
      await investorPage.mouse.down();
      await investorPage.mouse.move(box.x + 180, box.y + 30, { steps: 8 });
      await investorPage.mouse.up();
      await investorPage.getByTestId("nda-authorised").check();
      await investorPage.getByTestId("nda-sign-submit").click();
      await expect(investorPage.getByTestId("nda-signed-chip")).toBeVisible();
      await context.close();
    });

    await test.step("staff grant access", async () => {
      await page.goto(`/engagement/${IDS.engagement}`);
      await page.getByTestId("grant-deal-access").click();
      await expect(page.getByTestId("deal-access-granted")).toBeVisible();
      const engagement = await prisma.engagement.findUniqueOrThrow({ where: { id: IDS.engagement } });
      expect(engagement.engagementStage).toBe("NDASigned");
      expect(engagement.accessGrantedAt).not.toBeNull();
    });

    await test.step("the investor's portal now says Access granted and shows real figures", async () => {
      const context = await browser.newContext({ storageState: investorStorageState });
      const investorPage = await context.newPage();

      await investorPage.goto("/portal/investor/pipeline");
      await expect(investorPage.getByTestId(`pipeline-status-${IDS.transaction}`)).toHaveText("Access granted");

      await investorPage.goto(`/portal/investor/deals/${IDS.transaction}`);
      await expect(investorPage.getByTestId("interest-received-banner")).toHaveCount(0);
      // Unmasked: exact revenue rather than a band.
      await expect(investorPage.getByText("Revenue (last year)")).toBeVisible();
      await expect(investorPage.getByText("Revenue (range)")).toHaveCount(0);
      await context.close();
    });

    await test.step("the investor was notified, by codename", async () => {
      const notification = await prisma.notification.findFirst({
        where: { investorId: IDS.investor, kind: "deal_access_granted" },
        orderBy: { createdAt: "desc" },
      });
      expect(notification?.href).toBe(`/portal/investor/deals/${IDS.transaction}`);
      expect(notification?.title).not.toContain("zz-E2E Transaction");
    });
  });
});
