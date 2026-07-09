import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { verifyOtpChallenge } from "../otp";
import { readDevOtp } from "../dev-otp-sink";
import {
  issueLoginOtp, maskEmail, signPending, signTrust, verifyPending, verifyTrust,
} from "../two-factor";

const PRIOR = process.env.AUTH_SECRET;
beforeAll(() => { process.env.AUTH_SECRET = "zz-test-secret-two-factor-0123456789"; });
afterAll(async () => {
  if (PRIOR === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = PRIOR;
  await prisma.authAccount.deleteMany({ where: { email: { startsWith: "zz-test-2fa" } } });
});

describe("two-factor cookies", () => {
  it("round-trips a pending token", async () => {
    const jwt = await signPending({ accountId: "a1", challengeId: "c1", emailMask: "x***@y.com" });
    expect(await verifyPending(jwt)).toEqual({ accountId: "a1", challengeId: "c1", emailMask: "x***@y.com" });
  });
  it("rejects garbage / undefined pending", async () => {
    expect(await verifyPending(undefined)).toBeNull();
    expect(await verifyPending("not.a.jwt")).toBeNull();
  });
  it("trust token is valid only for its account", async () => {
    const jwt = await signTrust("acct-A");
    expect(await verifyTrust(jwt, "acct-A")).toBe(true);
    expect(await verifyTrust(jwt, "acct-B")).toBe(false);
    expect(await verifyTrust(undefined, "acct-A")).toBe(false);
  });
  it("masks emails", () => {
    expect(maskEmail("cmiriti@ifc.org")).toMatch(/^c.*@ifc\.org$/);
    expect(maskEmail("cmiriti@ifc.org")).not.toBe("cmiriti@ifc.org");
  });
  it("issues a login OTP that verifies", async () => {
    const acct = await prisma.authAccount.create({
      data: { email: `zz-test-2fa-${Date.now()}@example.com`, passwordHash: "x", kind: "INVESTOR", status: "ACTIVE" },
    });
    const { challengeId, emailMask } = await issueLoginOtp({ id: acct.id, email: acct.email });
    expect(emailMask).toContain("@");
    const code = readDevOtp(acct.email); // console fallback records it
    expect(code).toMatch(/^\d{6}$/);
    expect((await verifyOtpChallenge(challengeId, code!)).status).toBe("ok");
  });
});
