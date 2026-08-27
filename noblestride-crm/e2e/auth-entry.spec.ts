// F1.1 — "separate the sign-up / sign-in entry for clients and investors, and
// the fourth card should be Noblestride staff" (feedback §1 / image1; Aika's
// role-first entry, §2c).
//
// The tabs are copy-only on purpose, and this spec pins that: a fund signing in
// from the STAFF tab still lands in the investor portal. Gating by tab would
// leak which kind an email belongs to, and would lock out anyone who is both a
// partner contact and a fund contact.
import { test, expect } from "@playwright/test";
import { INVESTOR, EMPTY_STORAGE } from "./helpers/login";

test.use({ storageState: EMPTY_STORAGE });

test.describe("F1.1 — role-separated sign-in and registration front door", () => {
  test("/login offers four roles, and each one changes only the help text", async ({ page }) => {
    await test.step("all four tabs are present, staff included", async () => {
      await page.goto("/login");
      for (const role of ["client", "investor", "partner", "staff"]) {
        await expect(page.getByTestId(`login-tab-${role}`)).toBeVisible();
      }
      await expect(page.getByTestId("login-tab-staff")).toContainText("Noblestride staff");
    });

    await test.step("the page says the tabs are only help text", async () => {
      await expect(page.getByText("Tabs only change the help text")).toBeVisible();
    });

    await test.step("the Client tab points at the application tracker (G1)", async () => {
      await page.goto("/login?as=client");
      await expect(page.getByTestId("login-tab-client")).toHaveAttribute("aria-selected", "true");
      const track = page.getByRole("link", { name: /Track your application/ });
      await expect(track).toHaveAttribute("href", "/apply/status");
    });

    await test.step("the Investor tab points at fund registration", async () => {
      await page.goto("/login?as=investor");
      await expect(page.getByRole("link", { name: /Register your fund/ })).toHaveAttribute(
        "href",
        "/register?path=fund",
      );
    });

    await test.step("the Partner tab points at claiming an invitation", async () => {
      await page.goto("/login?as=partner");
      await expect(page.getByRole("link", { name: /Have an invitation/ })).toHaveAttribute(
        "href",
        "/register?path=partner",
      );
    });

    await test.step("an unknown ?as= falls back to staff rather than erroring", async () => {
      await page.goto("/login?as=not-a-role");
      await expect(page.getByTestId("login-tab-staff")).toHaveAttribute("aria-selected", "true");
    });
  });

  test("the tabs never gate a login: a fund signs in from the staff tab", async ({ page }) => {
    await page.goto("/login?as=staff");
    await page.fill("#email", INVESTOR.email);
    await page.fill("#password", INVESTOR.password);
    await page.click('button[type="submit"]');
    // Its own viewpoint decides the landing route, not the tab.
    await page.waitForURL(/\/portal\/investor/, { timeout: 60_000 });
    await expect(page).toHaveURL(/\/portal\/investor/);
  });

  test("/register opens with four role cards, each routed to its own form", async ({ page }) => {
    await page.goto("/register");

    await test.step("the four cards image1 asked for", async () => {
      await expect(page.getByTestId("register-role-client")).toContainText("Company raising capital");
      await expect(page.getByTestId("register-role-investor")).toContainText("Investor or fund");
      await expect(page.getByTestId("register-role-partner")).toContainText("Referral partner");
      await expect(page.getByTestId("register-role-staff")).toContainText("Noblestride staff");
    });

    for (const [role, href] of [
      ["client", "/intake"],
      ["investor", "/register?path=fund"],
      ["partner", "/register?path=partner"],
      ["staff", "/register?path=internal"],
    ] as const) {
      await test.step(`the ${role} card goes to ${href}`, async () => {
        await expect(page.getByTestId(`register-role-${role}`)).toHaveAttribute("href", href);
      });
    }

    await test.step("the partner card leads to the invitation-claim form", async () => {
      await page.goto("/register?path=partner");
      await expect(page.getByText(/invitation/i).first()).toBeVisible();
    });
  });
});
