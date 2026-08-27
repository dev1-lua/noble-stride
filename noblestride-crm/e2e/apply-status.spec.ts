// F2.4 / G1 — "give visibility to the client of the information submitted and
// the status", and "client access to the portal for submission of the
// documents" (feedback §5 intake agent / image25).
//
// There was no client-facing surface at all: /apply hosted a chat agent and
// /intake was a write-only form. This spec drives the whole public tracker,
// unauthenticated, including the two things that must NOT happen: the page must
// never reveal whether an email is on file, and it must never name an investor.
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { EMPTY_STORAGE } from "./helpers/login";
import { readOtp, otpSinkAvailable } from "./helpers/otp";

const prisma = new PrismaClient();

const APPLICANT_EMAIL = "zz-solomon@e2e-applicant.test";
const COMPANY = "zz-E2E Applicant (Website)";

test.use({ storageState: EMPTY_STORAGE });

test.describe("F2.4 / G1 — an applicant can check what they submitted and where it stands", () => {
  test.beforeAll(async () => {
    if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
    // Codes are only readable when the app is on the console mailer.
    test.skip(!otpSinkAvailable(), "RESEND_API_KEY is set — the OTP goes to a real mailbox");
    // Clears the DB half of the throttle. The in-memory half (3 requests per
    // address per 15 minutes, src/server/services/applicant-status.ts) is the
    // reason this spec asks for exactly ONE code per run.
    await prisma.applicantOtpChallenge.deleteMany({ where: { email: APPLICANT_EMAIL } });
  });
  test.afterAll(async () => {
    await prisma.applicantOtpChallenge.deleteMany({ where: { email: APPLICANT_EMAIL } });
    await prisma.$disconnect();
  });

  test("email → code → the application, its status and the documents on file", async ({ page }) => {
    const sentAfter = Date.now();

    await test.step("the tracker asks only for the email they applied with", async () => {
      await page.goto("/apply/status");
      await expect(page.getByTestId("applicant-email-form")).toBeVisible();
      await page.fill("#email", APPLICANT_EMAIL);
      await page.click('button[type="submit"]');
      await expect(page.getByTestId("applicant-code-form")).toBeVisible();
    });

    await test.step("the code arrives and unlocks the status page", async () => {
      const code = await readOtp(APPLICANT_EMAIL, { after: sentAfter });
      expect(code).toMatch(/^\d{6}$/);
      await page.fill("#code", code);
      await page.click('button[type="submit"]');
      await expect(page.getByTestId("applicant-application")).toBeVisible();
    });

    await test.step("the card names the company, the status and the contact on file", async () => {
      const card = page.getByTestId("applicant-application").filter({ hasText: COMPANY });
      await expect(card).toHaveCount(1);
      await expect(card.getByTestId("applicant-status-chip")).toBeVisible();
      await expect(card).toContainText("Solomon Oulula");
    });

    await test.step("it never names an investor — only a count (G1)", async () => {
      const body = (await page.locator("body").innerText()).toLowerCase();
      expect(body).not.toContain("zz-e2e investor");
      expect(body).not.toContain("investor contact");
    });

    await test.step("and there is a way to upload a document", async () => {
      await expect(page.getByTestId("applicant-upload").first()).toBeVisible();
    });

    await test.step("signing out drops the session", async () => {
      await page.getByRole("button", { name: /sign out of application tracking/i }).click();
      await expect(page.getByTestId("applicant-email-form")).toBeVisible();
    });
  });

  test("an unknown email gets the identical answer — no existence oracle", async ({ page }) => {
    await page.goto("/apply/status");
    await page.fill("#email", "zz-nobody-at-all@e2e-applicant.test");
    await page.click('button[type="submit"]');
    // Same next screen as a known address: the page must not say "no such
    // application", which would let anybody enumerate Noblestride's pipeline.
    await expect(page.getByTestId("applicant-code-form")).toBeVisible();
  });

  test("a wrong code fails generically", async ({ page }) => {
    // Straight to the code step rather than asking for another code: requests
    // are deliberately capped at 3 per address per 15 minutes, and spending one
    // here would make three consecutive suite runs flaky for no added coverage.
    await page.goto(`/apply/status?step=code&email=${encodeURIComponent(APPLICANT_EMAIL)}`);
    await expect(page.getByTestId("applicant-code-form")).toBeVisible();
    await page.fill("#code", "000000");
    await page.click('button[type="submit"]');
    await expect(page.getByTestId("applicant-application")).toHaveCount(0);
    await expect(page.getByText(/code/i).first()).toBeVisible();
  });
});
