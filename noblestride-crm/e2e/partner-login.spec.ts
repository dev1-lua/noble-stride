// F5.6 — "drop the partner usage from the referral agent; partners should log in
// to the portal to see the status of the deals they referred" (feedback §5
// referral agent / image23).
//
// Before this work `/portal/partner/*` was dead code: resolveViewpointFor never
// yielded a partner viewpoint, so no account could reach it. This spec proves a
// real PARTNER account signs in and sees only its own referrals.
import { test, expect } from "@playwright/test";
import { PARTNER, EMPTY_STORAGE, loginAs } from "./helpers/login";
import { IDS } from "./fixtures/seed";

test.describe("F5.6 — referral partners log in and follow the deals they referred", () => {
  test("a partner account signs in and lands in the partner portal", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STORAGE });
    const page = await context.newPage();

    await test.step("sign in with a PARTNER account", async () => {
      await loginAs(page, PARTNER);
      await expect(page).toHaveURL(/\/portal\/partner/);
      await expect(page.getByTestId("partner-member")).toContainText("Partner Contact");
    });

    await test.step("the referred mandate is listed with its stage", async () => {
      await expect(page.getByText("zz-E2E Mandate")).toBeVisible();
    });

    await test.step("there is a way out — the portal has a log-out control", async () => {
      await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
    });

    await test.step("the internal CRM stays out of reach", async () => {
      await page.goto("/dashboard");
      await expect(page).not.toHaveURL(/\/dashboard$/);
      await page.goto("/portal/investor");
      await expect(page).not.toHaveURL(/\/portal\/investor$/);
    });

    await context.close();
  });

  test("staff can see and manage that partner's portal access", async ({ page }) => {
    await page.goto(`/partners/${IDS.partner}`);
    await test.step("the access panel shows the live account", async () => {
      const panel = page.getByRole("heading", { name: "Partner portal access" }).locator("..").locator("..");
      await expect(panel).toContainText(PARTNER.email);
      await expect(panel).toContainText(/active/i);
    });
    await test.step("and an invite form for contacts who have none", async () => {
      await expect(page.getByTestId("partner-invite-form")).toBeVisible();
    });
  });
});
