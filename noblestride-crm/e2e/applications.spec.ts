// F2.1 / F2.3 — "the application from the website syncs into the CRM, but the
// only way to reach it is the notification bell" and "the contact information
// from the intake is not captured" (feedback §2 texts 1 and 3 / image2, image4).
//
// The contacts WERE being persisted all along; nothing rendered them. So this
// spec checks two things: that the queue is a first-class page with a nav badge,
// and that the applicant's name, role, email and phone appear on both the queue
// and the mandate the reviewer opens.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

const APPLICANT = {
  company: "zz-E2E Applicant (Website)",
  name: "Solomon Oulula",
  role: "Managing Director",
  email: "zz-solomon@e2e-applicant.test",
  phone: "+254700000111",
};

test.describe("F2.1 / F2.3 — website applications are a first-class queue, with the applicant's contact details", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    // Put the fixture back in "awaiting review" in case a prior run accepted it.
    await prisma.mandate.update({
      where: { id: IDS.applicantMandate },
      data: { leadId: null, dealStatus: "Open", stage: "NewLead" },
    });
  });
  test.afterAll(async () => {
    await prisma.mandate.update({
      where: { id: IDS.applicantMandate },
      data: { leadId: null, dealStatus: "Open", stage: "NewLead" },
    });
    await prisma.$disconnect();
  });

  test("the queue is reachable from the sidebar, not just the bell", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("link", { name: /^Applications/ });
    await expect(nav).toBeVisible();
    // image2's actual complaint: nothing told you there was anything waiting.
    await expect(nav).toContainText(/\d/);
    await nav.click();
    await expect(page).toHaveURL(/\/applications/);
  });

  test("the awaiting tab shows the application with its applicant", async ({ page }) => {
    await page.goto("/applications");

    await test.step("three tabs, awaiting selected", async () => {
      await expect(page.getByTestId("applications-tab-awaiting")).toHaveAttribute("aria-selected", "true");
      await expect(page.getByTestId("applications-tab-accepted")).toBeVisible();
      await expect(page.getByTestId("applications-tab-dropped")).toBeVisible();
    });

    await test.step("the row carries name, role, email and phone (F2.3)", async () => {
      const row = page.getByTestId("application-row").filter({ hasText: APPLICANT.company });
      await expect(row).toHaveCount(1);
      for (const value of [APPLICANT.name, APPLICANT.role, APPLICANT.email, APPLICANT.phone]) {
        await expect(row).toContainText(value);
      }
    });

    await test.step("search narrows by the contact's surname", async () => {
      await page.getByTestId("applications-search").fill("Oulula");
      await page.getByTestId("applications-search").press("Enter");
      await expect(page.getByTestId("application-row")).toHaveCount(1);
      await expect(page.getByTestId("application-row")).toContainText(APPLICANT.company);
    });
  });

  test("the mandate the reviewer opens repeats the same four fields", async ({ page }) => {
    await page.goto(`/mandates/${IDS.applicantMandate}`);
    const applicant = page.getByTestId("intake-applicant");
    await expect(applicant).toBeVisible();
    for (const value of [APPLICANT.name, APPLICANT.role, APPLICANT.email, APPLICANT.phone]) {
      await expect(applicant).toContainText(value);
    }
  });

  test("accepting an application moves it to the Accepted tab", async ({ page }) => {
    await page.goto("/applications");
    const row = page.getByTestId("application-row").filter({ hasText: APPLICANT.company });
    // Accepting means assigning a deal lead — the button stays disabled until
    // one is chosen, which is the point: an accepted application has an owner.
    await row.getByLabel(`Assign a deal lead for ${APPLICANT.company}`).selectOption({ index: 1 });
    await row.getByRole("button", { name: /accept/i }).click();

    await expect
      .poll(async () => (await prisma.mandate.findUniqueOrThrow({ where: { id: IDS.applicantMandate } })).leadId)
      .not.toBeNull();

    await page.goto("/applications?tab=accepted");
    await expect(
      page.getByTestId("application-row").filter({ hasText: APPLICANT.company }),
    ).toHaveCount(1);
    await expect(page.getByTestId("applications-tab-awaiting")).not.toContainText("(1)");
  });
});
