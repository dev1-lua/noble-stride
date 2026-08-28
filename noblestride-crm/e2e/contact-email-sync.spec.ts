// F3.6 — "if the email of a contact is changed, does it update the account
// record?" (feedback §3 text 6 / image11, image12).
//
// It did not: updatePerson wrote Person.email and left AuthAccount.email — the
// address the person actually signs in with — untouched, so the CRM and the
// login diverged silently. This spec proves the two now move together, that the
// old address stops working, and that the change is auditable.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_PASSWORD, EMPTY_STORAGE } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

const OLD_EMAIL = "zz-e2e-colleague@e2e.noblestride.test";
const NEW_EMAIL = "zz-e2e-colleague2@e2e.noblestride.test";

async function resetEmail(): Promise<void> {
  await prisma.authAccount.updateMany({ where: { email: NEW_EMAIL }, data: { email: OLD_EMAIL } });
  await prisma.person.updateMany({ where: { id: IDS.investorColleague }, data: { email: OLD_EMAIL } });
  await prisma.stageChange.deleteMany({ where: { investorId: IDS.investor, field: "email" } });
}

test.describe("F3.6 — changing a contact's email moves the account they sign in with", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    await resetEmail();
  });
  test.afterAll(async () => {
    await resetEmail();
    await prisma.$disconnect();
  });

  test("staff change the sign-in email, and both records move together", async ({ page, browser }) => {
    await test.step("the old address signs in today", async () => {
      const anon = await browser.newContext({ storageState: EMPTY_STORAGE });
      const anonPage = await anon.newPage();
      await anonPage.goto("/login");
      await anonPage.fill("#email", OLD_EMAIL);
      await anonPage.fill("#password", E2E_PASSWORD);
      await anonPage.click('button[type="submit"]');
      await anonPage.waitForURL(/\/portal\/investor/, { timeout: 60_000 });
      await anon.close();
    });

    await test.step("an admin moves the address on the fund's account panel", async () => {
      await page.goto(`/investors/${IDS.investor}`);
      const form = page
        .getByTestId("change-email-form")
        .filter({ has: page.locator(`input[placeholder="${OLD_EMAIL}"]`) });
      await form.getByLabel("New sign-in email").fill(NEW_EMAIL);
      await form.getByRole("button", { name: "Change email" }).click();
      // The panel re-renders with the NEW address, so the notice is asserted on
      // the page rather than through a locator keyed to the old one.
      await expect(page.getByTestId("email-changed").first()).toBeVisible();
    });

    await test.step("the account record itself moved, not just the contact", async () => {
      const account = await prisma.authAccount.findUnique({ where: { email: NEW_EMAIL } });
      expect(account).not.toBeNull();
      expect(account?.personId).toBe(IDS.investorColleague);
      const person = await prisma.person.findUniqueOrThrow({ where: { id: IDS.investorColleague } });
      expect(person.email).toBe(NEW_EMAIL);
      expect(await prisma.authAccount.findUnique({ where: { email: OLD_EMAIL } })).toBeNull();
    });

    await test.step("the change is on the audit trail", async () => {
      const change = await prisma.stageChange.findFirst({
        where: { investorId: IDS.investor, field: "email" },
        orderBy: { changedAt: "desc" },
      });
      expect(change?.fromValue).toBe(OLD_EMAIL);
      expect(change?.toValue).toBe(NEW_EMAIL);
    });

    await test.step("every session on the account was invalidated", async () => {
      // Sessions are deleted rather than flagged, so "signed out everywhere"
      // means no rows survive for the account.
      const sessions = await prisma.authSession.count({ where: { account: { email: NEW_EMAIL } } });
      expect(sessions).toBe(0);
    });

    await test.step("the old address no longer signs in; the new one does", async () => {
      const anon = await browser.newContext({ storageState: EMPTY_STORAGE });
      const anonPage = await anon.newPage();

      await anonPage.goto("/login");
      await anonPage.fill("#email", OLD_EMAIL);
      await anonPage.fill("#password", E2E_PASSWORD);
      await anonPage.click('button[type="submit"]');
      await expect(anonPage.getByText("Incorrect email or password.")).toBeVisible();

      // Fresh page rather than reusing the errored form, so nothing about the
      // previous attempt can be blamed for the result.
      await anonPage.goto("/login");
      await anonPage.fill("#email", NEW_EMAIL);
      await anonPage.fill("#password", E2E_PASSWORD);
      await anonPage.click('button[type="submit"]');
      await anonPage.waitForURL(/\/portal\/investor/, { timeout: 60_000 });

      await anon.close();
    });
  });
});
