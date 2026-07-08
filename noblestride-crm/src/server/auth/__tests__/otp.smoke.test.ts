import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createOtpChallenge,
  generateOtpCode,
  hashOtpCode,
  OTP_MAX_ATTEMPTS,
  verifyOtpChallenge,
} from "../otp";

const EMAIL = "zz-test-otp@example.com";

async function makeAccount() {
  return prisma.authAccount.create({
    data: { email: `zz-test-otp-${Date.now()}@example.com`, passwordHash: "x", kind: "INVESTOR", status: "ACTIVE" },
  });
}

afterAll(async () => {
  await prisma.authAccount.deleteMany({ where: { email: { startsWith: "zz-test-otp" } } });
});

describe("otp core", () => {
  it("generates a 6-digit numeric code", () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("hashes and does not store plaintext", () => {
    expect(hashOtpCode("123456")).not.toBe("123456");
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
  });

  it("verifies a correct code once (single-use)", async () => {
    const acct = await makeAccount();
    const { challengeId, code } = await createOtpChallenge(acct.id, EMAIL);
    const ok = await verifyOtpChallenge(challengeId, code);
    expect(ok).toEqual({ status: "ok", accountId: acct.id });
    const again = await verifyOtpChallenge(challengeId, code);
    expect(again.status).toBe("expired");
  });

  it("rejects a wrong code and decrements remaining, locks at max", async () => {
    const acct = await makeAccount();
    const { challengeId } = await createOtpChallenge(acct.id, EMAIL);
    let res = await verifyOtpChallenge(challengeId, "000000");
    expect(res.status === "invalid" && res.remaining === OTP_MAX_ATTEMPTS - 1).toBe(true);
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) res = await verifyOtpChallenge(challengeId, "000000");
    expect(res.status).toBe("locked");
  });

  it("treats an expired challenge as expired", async () => {
    const acct = await makeAccount();
    const { challengeId, code } = await createOtpChallenge(acct.id, EMAIL);
    await prisma.authOtpChallenge.update({ where: { id: challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await verifyOtpChallenge(challengeId, code)).status).toBe("expired");
  });
});
