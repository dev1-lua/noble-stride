// F6b.1 — "the investor should be able to see all the deals … filter them, and
// generate interest, which notifies the deal lead" (feedback §6b text 1 /
// image27).
//
// Before this change the portal showed only deals the discovery filters matched,
// so an investor could not even see — let alone act on — the rest of the market.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { INVESTOR, EMPTY_STORAGE, loginAs } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

test.describe("F6b.1 — the investor sees every live opportunity and can register interest on any of them", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  });
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("browse all vs matches my mandate, and express interest from a card", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STORAGE });
    const page = await context.newPage();
    await loginAs(page, INVESTOR);

    let browseCount = 0;
    let matchCount = 0;

    await test.step("the portal opens on Browse all — the whole live market", async () => {
      await page.goto("/portal/investor");
      const browseTab = page.getByTestId("portal-tab-browse");
      const matchTab = page.getByTestId("portal-tab-match");
      await expect(browseTab).toHaveAttribute("aria-selected", "true");

      browseCount = Number((await browseTab.innerText()).match(/\((\d+)\)/)?.[1] ?? "0");
      matchCount = Number((await matchTab.innerText()).match(/\((\d+)\)/)?.[1] ?? "0");
      // The restored dump has many live deals; the seeded fund's mandate
      // (Agribusiness / East Africa) matches only some of them. That gap is the
      // whole point of the feedback item.
      expect(browseCount).toBeGreaterThan(matchCount);
      await expect(page.locator('a[href^="/portal/investor/deals/"]')).toHaveCount(browseCount);
    });

    await test.step("the mandate tab narrows to matches, each badged", async () => {
      await page.getByTestId("portal-tab-match").click();
      await expect(page).toHaveURL(/match=1/);
      await expect(page.locator('a[href^="/portal/investor/deals/"]')).toHaveCount(matchCount);
      if (matchCount > 0) {
        await expect(page.locator('[data-testid^="match-chip-"]')).toHaveCount(matchCount);
      }
    });

    await test.step("a deal outside the mandate is still browsable and actionable", async () => {
      await page.goto("/portal/investor");
      // Find a card with no "Matches your mandate" chip.
      const cards = page.locator('a[href^="/portal/investor/deals/"]');
      let target: string | null = null;
      for (let i = 0; i < (await cards.count()); i += 1) {
        const href = await cards.nth(i).getAttribute("href");
        const dealId = href?.split("/").pop();
        if (!dealId) continue;
        if ((await page.getByTestId(`match-chip-${dealId}`).count()) === 0) {
          target = dealId;
          break;
        }
      }
      expect(target, "expected at least one off-mandate live deal").not.toBeNull();
      const dealId = target as string;

      // Clean slate for this deal, so the button is the one on offer.
      await prisma.engagement.deleteMany({ where: { investorId: IDS.investor, transactionId: dealId } });
      await page.reload();

      await page.getByTestId(`open-express-interest-${dealId}`).click();
      await page.getByTestId(`interest-message-${dealId}`).fill("zz- e2e: please send the teaser.");
      await page.getByTestId(`express-interest-${dealId}`).click();

      // returnTo brought us back to the grid, not the deal page.
      await expect(page).toHaveURL(/\/portal\/investor\?interest=sent$/);
      await expect(page.getByTestId(`interest-registered-${dealId}`)).toBeVisible();

      const engagement = await prisma.engagement.findFirstOrThrow({
        where: { investorId: IDS.investor, transactionId: dealId },
      });
      expect(engagement.status).toBe("Interested");
      expect(engagement.engagementStage).toBe("Shared");

      // image27's actual ask: the deal lead hears about it.
      await expect
        .poll(async () =>
          prisma.notification.count({
            where: { kind: "interest_expressed", href: `/engagement/${engagement.id}#conversation` },
          }),
        )
        .toBeGreaterThan(0);

      await prisma.activity.deleteMany({ where: { engagementId: engagement.id } });
      await prisma.notification.deleteMany({ where: { href: `/engagement/${engagement.id}#conversation` } });
      await prisma.engagement.deleteMany({ where: { id: engagement.id } });
    });

    await test.step("an off-site returnTo is refused, not followed", async () => {
      // Submitting a hostile returnTo lands on the deal page instead.
      const dealId = (await prisma.engagement.findFirstOrThrow({
        where: { investorId: IDS.investor },
        select: { transactionId: true },
      })).transactionId;
      const response = await page.request.post(`/portal/investor/deals/${dealId}`, {
        form: { dealId, returnTo: "https://evil.test", message: "" },
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      // Whatever the server does with a raw POST, it must never answer with a
      // redirect to another origin.
      expect(response.headers()["location"] ?? "").not.toContain("evil.test");
    });

    await context.close();
  });
});
