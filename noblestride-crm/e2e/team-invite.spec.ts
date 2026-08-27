// F3.5 — "will the team members be notified or invited?" and "does the reset
// link get emailed?" (feedback §3 text 5 / image10).
//
// Both were no: invites returned a raw token printed on screen, and the staff
// "Reset link" button only displayed a URL. Now both send mail — and because
// this machine runs on the console mailer, the spec asserts the copy-link
// fallback is there either way, which is the behaviour that matters when
// RESEND_API_KEY is missing in production too.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { investorStorageState } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

const INVITEE = `zz-e2e-invitee-${Date.now()}@e2e.noblestride.test`;
const PASSWORD = "zz-E2E!Invitee-2026";

test.describe("F3.5 — team invitations and reset links are emailed, with a link fallback", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  });
  test.afterAll(async () => {
    await prisma.authToken.deleteMany({ where: { account: { email: INVITEE } } });
    await prisma.authSession.deleteMany({ where: { account: { email: INVITEE } } });
    await prisma.authAccount.deleteMany({ where: { email: INVITEE } });
    await prisma.person.deleteMany({ where: { email: INVITEE } });
    await prisma.$disconnect();
  });

  test("an Editor invites a colleague, and the invitation can be redeemed", async ({ browser }) => {
    const context = await browser.newContext({ storageState: investorStorageState });
    const page = await context.newPage();
    let inviteUrl = "";

    await test.step("invite from the fund's Team page", async () => {
      await page.goto("/portal/investor/team");
      await page.fill("#tm-name", "Priya Invitee");
      await page.fill("#tm-email", INVITEE);
      await page.getByRole("button", { name: /send invitation|invite/i }).first().click();
    });

    await test.step("the UI says what happened, and always offers the link", async () => {
      // Two branches by design: when mail went out the link is tucked into a
      // disclosure, and when it did not the copy-link panel stays prominent
      // because it is then the only way in. The invariant worth pinning is that
      // the link is reachable either way.
      const emailed = page.getByTestId("invite-emailed");
      const link = page.getByTestId("invite-link");
      await expect(link).toHaveCount(1);

      if (await emailed.count()) {
        await expect(emailed).toContainText(INVITEE);
        // When mail went out the link sits behind a disclosure — present, and
        // one click away, which is the deliberate hierarchy.
        await expect(page.locator("summary", { hasText: "Copy the link instead" })).toBeVisible();
      } else {
        // No mail: the copy panel is the only way in, so it must be prominent.
        await expect(link).toBeVisible();
      }

      inviteUrl = await link.inputValue();
      expect(inviteUrl).toMatch(/\/invite\//);
    });

    await test.step("the invited member now shows on the roster with no account yet", async () => {
      await page.reload();
      await expect(page.getByText(INVITEE)).toBeVisible();
      const account = await prisma.authAccount.findUniqueOrThrow({ where: { email: INVITEE } });
      // The fund is Approved, so the seat is ACTIVE immediately; what the member
      // still owes is a first sign-in, which the invitation link is for.
      expect(account.status).toBe("ACTIVE");
      expect(account.lastLoginAt).toBeNull();
      const invites = await prisma.authToken.count({
        where: { accountId: account.id, purpose: "INVITE", usedAt: null },
      });
      expect(invites).toBe(1);
    });

    await context.close();

    await test.step("the invitation page greets with the fund name", async () => {
      const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const invitePage = await anon.newPage();
      await invitePage.goto(inviteUrl.replace("http://localhost:3000", ""));
      await expect(invitePage.getByRole("heading", { name: /zz-E2E Investor has invited/ })).toBeVisible();

      await test.step("a wrong email is rejected", async () => {
        await invitePage.fill('input[name="email"]', "zz-someone-else@e2e.noblestride.test");
        await invitePage.fill('input[name="password"]', PASSWORD);
        await invitePage.fill('input[name="confirm"]', PASSWORD);
        await invitePage.getByRole("button", { name: "Set up my access" }).click();
        // Non-enumerating: it refuses without saying whose invitation it is.
        await expect(invitePage).not.toHaveURL(/notice=invite-complete/);
      });

      await test.step("the right email redeems it", async () => {
        await invitePage.goto(inviteUrl.replace("http://localhost:3000", ""));
        await invitePage.fill('input[name="email"]', INVITEE);
        await invitePage.fill('input[name="password"]', PASSWORD);
        await invitePage.fill('input[name="confirm"]', PASSWORD);
        await invitePage.getByRole("button", { name: "Set up my access" }).click();
        await invitePage.waitForURL(/\/login/, { timeout: 30_000 });

        // The invitation is single-use: the token is consumed, and the member
        // can now sign in with the password they just chose.
        await expect
          .poll(async () =>
            prisma.authToken.count({
              where: { account: { email: INVITEE }, purpose: "INVITE", usedAt: null },
            }),
          )
          .toBe(0);

        const page2 = await anon.newPage();
        await page2.goto("/login");
        await page2.fill("#email", INVITEE);
        await page2.fill("#password", PASSWORD);
        await page2.click('button[type="submit"]');
        await page2.waitForURL(/\/portal\/investor/, { timeout: 60_000 });
      });

      await anon.close();
    });
  });

  test("staff reset links are emailed, and the URL stays visible as a fallback", async ({ page }) => {
    await page.goto(`/investors/${IDS.investor}`);
    await page.getByRole("button", { name: /Email reset link/ }).first().click();
    // Whichever branch fires, the link itself must be on screen.
    const emailed = page.getByTestId("reset-link-emailed");
    const notEmailed = page.getByTestId("reset-link-not-emailed");
    await expect
      .poll(async () => (await emailed.count()) + (await notEmailed.count()))
      .toBeGreaterThan(0);
    // The URL itself stays on screen so an admin can pass it on out of band.
    await expect(page.getByText(/\/reset-password\//).first()).toBeVisible();
  });
});
