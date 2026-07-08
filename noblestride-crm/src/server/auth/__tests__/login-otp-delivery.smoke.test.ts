// Separate file (not login.smoke.test.ts) because it mocks the mailer module
// at the module level for ALL tests in this file — sendMail always rejects,
// simulating a Resend outage. Verifies loginWithPassword degrades gracefully
// (spec §4 email-delivery-failure handling) instead of throwing uncaught.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../mailer", () => ({
  mailProvider: () => "resend",
  buildResendPayload: (msg: unknown, from: string) => ({ from, ...(msg as object) }),
  sendMail: vi.fn().mockRejectedValue(new Error("zz-test: simulated Resend outage")),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("loginWithPassword — OTP delivery failure (DB)", () => {
  const SUFFIX = Math.random().toString(36).slice(2, 8);
  const EMAIL = `zz-test-otp-delivery-${SUFFIX}@example.com`;
  const PASSWORD = "Str0ng!Passw0rd";
  const PREV_AUTH_SECRET = process.env.AUTH_SECRET;

  beforeAll(() => {
    if (!process.env.AUTH_SECRET) process.env.AUTH_SECRET = "zz-test-otp-delivery-secret-do-not-use-in-prod";
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { startsWith: "zz-test-otp-delivery" } } });
    process.env.AUTH_SECRET = PREV_AUTH_SECRET;
  });

  it("returns { ok: false, reason: 'otp_unavailable' } for an ACTIVE investor when the OTP email fails to send", async () => {
    const { prisma } = await import("@/lib/db");
    const { hashPassword } = await import("../password");
    const { loginWithPassword } = await import("../login");
    await prisma.authAccount.create({
      data: { email: EMAIL, passwordHash: await hashPassword(PASSWORD), kind: "INVESTOR", status: "ACTIVE" },
    });

    const res = await loginWithPassword(EMAIL, PASSWORD);
    expect(res).toEqual({ ok: false, reason: "otp_unavailable" });
  });
});
