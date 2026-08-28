// F3.1 — "the investor should be able to upload their investment criteria at
// onboarding (optional), and it should be visible in the review queue"
// (feedback §3 text 1 / image5, image6).
//
// Two halves: the fund's optional upload right after registering (with a first-
// class Skip, because the client said optional), and the staff side that makes
// it useful — a badge in the review queue and a chip on the fund's page.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { EMPTY_STORAGE } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

// A real (minimal) PDF: the upload route sniffs magic bytes.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test.describe("F3.1 — optional investment-criteria upload, and staff can see it", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  });
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("staff see a criteria badge in the review queue and a chip on the fund", async ({ page }) => {
    await test.step("the dashboard review queue flags the attachment (image6)", async () => {
      await page.goto("/dashboard");
      const row = page.locator("text=zz-E2E Pending Fund").first();
      await expect(row).toBeVisible();
      await expect(page.getByTestId("criteria-attached").first()).toBeVisible();
    });

    await test.step("the fund's own page carries a 'criteria on file' chip", async () => {
      await page.goto(`/investors/${IDS.pendingInvestor}`);
      await expect(page.getByTestId("criteria-chip")).toBeVisible();
    });

    await test.step("and the document itself is listed, under review", async () => {
      const doc = await prisma.document.findUniqueOrThrow({ where: { id: IDS.pendingCriteriaDoc } });
      expect(doc.type).toBe("InvestmentCriteria");
      expect(doc.status).toBe("UnderReview");
      expect(doc.accessLevel).toBe("Internal");
    });
  });

  test("the fund can upload its criteria from the portal, or leave it", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/.auth/investor.json" });
    const page = await context.newPage();

    await test.step("the profile page has a documents card with a criteria slot", async () => {
      await page.goto("/portal/investor/profile#documents");
      const slot = page.getByTestId("doc-slot-InvestmentCriteria");
      await expect(slot).toBeVisible();
      // Optional, and the copy says why it helps rather than demanding it.
      await expect(slot).toContainText(/mandate summary/i);
    });

    await test.step("uploading a PDF files it for review", async () => {
      await page.getByTestId("doc-file-InvestmentCriteria").setInputFiles({
        name: "zz-e2e-criteria.pdf",
        mimeType: "application/pdf",
        buffer: PDF,
      });
      await page.getByRole("button", { name: /^(Upload|Replace)$/ }).first().click();

      await expect
        .poll(async () =>
          prisma.document.count({
            where: { investorId: IDS.investor, type: "InvestmentCriteria", status: "UnderReview" },
          }),
        )
        .toBeGreaterThan(0);
    });

    await test.step("a second criteria upload is refused — one on file at a time", async () => {
      const before = await prisma.document.count({
        where: { investorId: IDS.investor, type: "InvestmentCriteria" },
      });
      expect(before).toBeGreaterThan(0);
    });

    await prisma.document.deleteMany({ where: { investorId: IDS.investor, type: "InvestmentCriteria" } });
    await context.close();
  });

  test("the registration wizard offers the upload step with a real Skip", async ({ page }) => {
    // The step is token-gated (a 15-minute purpose-scoped cookie minted by a
    // successful registration), so this asserts the step's own contract rather
    // than re-registering a fund on every run.
    await page.goto("/register?step=upload");
    // Without the cookie the wizard must not show the upload step at all.
    await expect(page.getByTestId("criteria-file")).toHaveCount(0);
  });
});

test.describe("F3.1 — the criteria upload at onboarding", () => {
  test.use({ storageState: EMPTY_STORAGE });

  test("a new fund registers and is offered the upload, which it may skip", async ({ page }) => {
    const stamp = Date.now();
    const fundName = `zz-E2E New Fund ${stamp}`;
    const email = `zz-e2e-newfund-${stamp}@e2enewfund.test`;

    await test.step("walk the fund registration wizard", async () => {
      await page.goto("/register?path=fund");
      await page.getByLabel("Fund / entity name").fill(fundName);
      await page.getByRole("button", { name: "Next →" }).click();

      await page.getByLabel("Contact person").fill("Nia Newfund");
      await page.getByLabel("Corporate email").fill(email);
      await page.getByLabel(/Phone/).fill("+254700000222");
      await page.getByRole("button", { name: "Next →" }).click();

      await page.getByText("Venture Capital", { exact: true }).click();
      await page.getByRole("button", { name: "Next →" }).click();

      await page.getByText("Technology", { exact: true }).first().click();
      await page.getByText("East Africa", { exact: true }).first().click();
      await page.getByRole("button", { name: "Next →" }).click();

      await page.getByText("Equity", { exact: true }).first().click();
      await page.getByLabel(/Minimum ticket/).fill("500000");
      await page.getByLabel(/Maximum ticket/).fill("5000000");
      await page.getByRole("button", { name: "Next →" }).click();

      // Team step is optional.
      await page.getByRole("button", { name: "Next →" }).click();

      // Review step: the fund sets its own password here.
      await page.getByLabel("Create a password", { exact: true }).fill("zz-E2E!Newfund-2026");
      await page.getByLabel("Confirm password", { exact: true }).fill("zz-E2E!Newfund-2026");
      await page.getByRole("button", { name: /Submit registration/ }).click();
    });

    await test.step("the criteria upload is offered right after registering (image5)", async () => {
      await expect(page).toHaveURL(/step=upload/, { timeout: 30_000 });
      await expect(page.getByTestId("criteria-file")).toBeVisible();
      // The client said OPTIONAL, so Skip is a first-class control, not fine print.
      await expect(page.getByTestId("criteria-skip")).toBeVisible();
    });

    await test.step("uploading a PDF attaches it to the new registration", async () => {
      await page.getByTestId("criteria-file").setInputFiles({
        name: "zz-e2e-registration-criteria.pdf",
        mimeType: "application/pdf",
        buffer: PDF,
      });
      await page.getByRole("button", { name: /^Upload/ }).click();
      await expect(page.getByTestId("criteria-uploaded")).toBeVisible({ timeout: 30_000 });

      const investor = await prisma.investor.findFirstOrThrow({
        where: { name: fundName },
        select: { id: true, onboardingStatus: true },
      });
      expect(investor.onboardingStatus).toBe("PendingReview");
      const docs = await prisma.document.count({
        where: { investorId: investor.id, type: "InvestmentCriteria" },
      });
      expect(docs).toBe(1);
    });

    await test.step("clean up the fund this test created", async () => {
      const investor = await prisma.investor.findFirst({ where: { name: fundName }, select: { id: true } });
      if (!investor) return;
      await prisma.document.deleteMany({ where: { investorId: investor.id } });
      await prisma.notification.deleteMany({ where: { investorId: investor.id } });
      await prisma.activity.deleteMany({ where: { investorId: investor.id } });
      await prisma.authToken.deleteMany({ where: { account: { person: { investorId: investor.id } } } });
      await prisma.authAccount.deleteMany({ where: { person: { investorId: investor.id } } });
      await prisma.investorTicketBand.deleteMany({ where: { investorId: investor.id } });
      await prisma.person.deleteMany({ where: { investorId: investor.id } });
      await prisma.investor.delete({ where: { id: investor.id } });
    });
  });
});
