// F3.2 — "the investor should be able to open the Noblestride NDA and sign it,
// or upload their own for sign-off" (feedback §3 text 2 / image7).
//
// Drives the real click-wrap: the fund reads the agreement in its portal, draws
// a signature, confirms it is an authorised signatory, and the Open NDA lands on
// the investor record — the same state staff recording an NDA produces. Then the
// staff side: the fund's own paper is countersigned from the investor page.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { INVESTOR, EMPTY_STORAGE, adminStorageState, loginAs } from "./helpers/login";
import { IDS } from "./fixtures/seed";

const prisma = new PrismaClient();

/** Put the seeded fund back to "no NDA" so the spec is repeatable. */
async function resetNda(): Promise<void> {
  await prisma.eSignEnvelope.deleteMany({ where: { investorId: IDS.investor } });
  await prisma.document.deleteMany({ where: { investorId: IDS.investor, type: "NDA" } });
  await prisma.investor.update({
    where: { id: IDS.investor },
    data: { ndaStatus: "None", openNdaSignedAt: null },
  });
}

test.describe("F3.2 — investor NDA: sign the Noblestride NDA, or upload your own", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    await resetNda();
  });

  test.afterAll(async () => {
    await resetNda();
    await prisma.$disconnect();
  });

  test("the fund opens the Noblestride NDA in its portal and signs it", async ({ browser }) => {
    const context = await browser.newContext({ storageState: EMPTY_STORAGE });
    const page = await context.newPage();

    await test.step("sign in to the investor portal", async () => {
      await loginAs(page, INVESTOR);
    });

    await test.step("a deal page offers the NDA rather than hiding behind it", async () => {
      await page.goto("/portal/investor");
      const firstDeal = page.locator('a[href^="/portal/investor/deals/"]').first();
      // The seeded engagement guarantees at least one visible deal — if this
      // ever finds none the prompt below would silently never be checked.
      await expect(firstDeal).toBeVisible();
      await firstDeal.click();
      await expect(page.getByTestId("nda-prompt")).toBeVisible();
      await page.getByTestId("nda-prompt-link").click();
      await expect(page).toHaveURL(/\/portal\/investor\/nda/);
    });

    await test.step("the agreement is readable, on Noblestride letterhead", async () => {
      await page.goto("/portal/investor/nda");
      const doc = page.getByTestId("nda-document");
      await expect(doc).toContainText("Noblestride Capital Limited");
      await expect(doc).toContainText("Confidential Information");
      await expect(doc).toContainText("Governing Law");
    });

    await test.step("drawing a signature and confirming authority signs it", async () => {
      const canvas = page.getByTestId("sig-canvas");
      // boundingBox() is viewport-relative: the pad sits below the agreement, so
      // without this the synthetic pointer events land outside the canvas.
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      if (!box) throw new Error("signature canvas has no box");
      await page.mouse.move(box.x + 40, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 120, box.y + 30, { steps: 8 });
      await page.mouse.move(box.x + 200, box.y + box.height - 30, { steps: 8 });
      await page.mouse.up();
      await expect(page.getByTestId("sig-preview")).toBeVisible();

      await page.getByTestId("nda-authorised").check();
      await page.getByTestId("nda-sign-submit").click();

      await expect(page.getByTestId("nda-notice")).toContainText("signed");
      await expect(page.getByTestId("nda-signed-chip")).toBeVisible();
    });

    await test.step("the signature is on the record, with the template version", async () => {
      const investor = await prisma.investor.findUniqueOrThrow({ where: { id: IDS.investor } });
      expect(investor.ndaStatus).toBe("OpenNDA");
      const envelope = await prisma.eSignEnvelope.findFirstOrThrow({
        where: { investorId: IDS.investor, provider: "clickwrap" },
      });
      expect(envelope.templateVersion).toBe("NS-OPEN-NDA-2026-08");
      expect(envelope.signatureImage).toMatch(/^data:image\/png;base64,/);
      const doc = await prisma.document.findFirstOrThrow({
        where: { investorId: IDS.investor, type: "NDA" },
      });
      expect(doc.status).toBe("Executed");
    });

    await test.step("the deal page no longer asks for an NDA", async () => {
      await page.goto("/portal/investor");
      const firstDeal = page.locator('a[href^="/portal/investor/deals/"]').first();
      await expect(firstDeal).toBeVisible();
      await firstDeal.click();
      await expect(page.getByTestId("nda-prompt")).toHaveCount(0);
    });

    await context.close();
  });

  test("the fund uploads its own NDA and staff countersign it", async ({ browser, page }) => {
    await resetNda();

    await test.step("the fund sends its own agreement for sign-off", async () => {
      const context = await browser.newContext({ storageState: EMPTY_STORAGE });
      const investorPage = await context.newPage();
      await loginAs(investorPage, INVESTOR);
      await investorPage.goto("/portal/investor/nda");
      await investorPage.getByTestId("own-nda-file").setInputFiles({
        name: "zz-e2e-own-nda.pdf",
        mimeType: "application/pdf",
        // A real (minimal) PDF: the upload route sniffs magic bytes.
        buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"),
      });
      await investorPage.getByTestId("own-nda-submit").click();
      await expect(investorPage.getByTestId("own-nda-list")).toContainText("zz-e2e-own-nda.pdf");
      // An unsigned upload is not an NDA.
      const investor = await prisma.investor.findUniqueOrThrow({ where: { id: IDS.investor } });
      expect(investor.ndaStatus).toBe("None");
      await context.close();
    });

    const uploaded = await prisma.document.findFirstOrThrow({
      where: { investorId: IDS.investor, type: "NDA", status: "UnderReview" },
      select: { id: true },
    });

    await test.step("the upload is waiting on the investor's NDA section", async () => {
      await page.goto(`/investors/${IDS.investor}`);
      const pending = page.getByTestId("pending-nda-uploads");
      await expect(pending).toContainText("zz-e2e-own-nda.pdf");
    });

    await test.step("Mark countersigned executes it and applies the Open NDA", async () => {
      await page.getByTestId("countersign-nda").first().click();
      await expect
        .poll(async () => (await prisma.document.findUniqueOrThrow({ where: { id: uploaded.id } })).status)
        .toBe("Executed");
      const investor = await prisma.investor.findUniqueOrThrow({ where: { id: IDS.investor } });
      expect(investor.ndaStatus).toBe("OpenNDA");
      const envelope = await prisma.eSignEnvelope.findFirstOrThrow({
        where: { investorId: IDS.investor, provider: "upload" },
      });
      expect(envelope.kind).toBe("OpenNda");
    });
  });

  test("staff can ask the fund to sign the standard NDA", async ({ page }) => {
    await resetNda();
    await page.goto(`/investors/${IDS.investor}`);
    await page.getByTestId("send-standard-nda").click();
    await expect(page.getByTestId("send-standard-nda")).toContainText("NDA requested");

    await expect
      .poll(async () =>
        prisma.notification.count({
          where: { investorId: IDS.investor, kind: "document_shared", href: "/portal/investor/nda" },
        }),
      )
      .toBeGreaterThan(0);

    // Asking is not signing: the guard is untouched.
    const investor = await prisma.investor.findUniqueOrThrow({ where: { id: IDS.investor } });
    expect(investor.ndaStatus).toBe("None");
  });
});

test.describe("F3.2 — the NDA surface respects the portal seat model", () => {
  test.use({ storageState: adminStorageState });

  test("the NDA page is not reachable from a staff session", async ({ page }) => {
    await page.goto("/portal/investor/nda");
    // requirePortalMember bounces to /login, which then sends an authenticated
    // staff session on to its own home — either way, not the portal NDA page.
    await expect(page).toHaveURL(/\/login|\/dashboard/);
  });
});
