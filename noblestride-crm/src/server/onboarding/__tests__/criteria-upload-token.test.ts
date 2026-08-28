// F3.1: after registering, the fund is offered a one-off investment-criteria
// upload. There is no session yet — the account is PENDING approval — so the
// hand-off is a short-lived, purpose-scoped token. Pure test: every way the
// token can be wrong, without a DB.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SignJWT } from "jose";
import {
  issueCriteriaUploadToken,
  verifyCriteriaUploadToken,
  REG_UPLOAD_TTL_S,
} from "../criteria-upload-token";

const PRIOR = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "zz-test-criteria-secret-0123456789ab";
});
afterAll(() => {
  if (PRIOR === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = PRIOR;
});

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
const mint = (claims: Record<string, unknown>, exp: string) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(secret());

describe("criteria upload token", () => {
  it("round-trips an investor id", async () => {
    const token = await issueCriteriaUploadToken("inv-123");
    expect(await verifyCriteriaUploadToken(token)).toEqual({ investorId: "inv-123" });
  });

  it("has a short life", () => {
    // A pre-approval upload window measured in hours would be a standing
    // unauthenticated write capability.
    expect(REG_UPLOAD_TTL_S).toBeLessThanOrEqual(900);
  });

  it("rejects a token minted for another purpose", async () => {
    const token = await mint({ investorId: "inv-123", purpose: "applicant-status" }, "900s");
    expect(await verifyCriteriaUploadToken(token)).toBeNull();
  });

  it("rejects a tampered signature, a missing claim and an expired token", async () => {
    const good = await issueCriteriaUploadToken("inv-123");
    expect(await verifyCriteriaUploadToken(good.slice(0, -2) + "xy")).toBeNull();
    expect(await verifyCriteriaUploadToken(await mint({ purpose: "criteria-upload" }, "900s"))).toBeNull();
    expect(
      await verifyCriteriaUploadToken(await mint({ investorId: "inv-123", purpose: "criteria-upload" }, "-1s")),
    ).toBeNull();
  });

  it("rejects garbage without throwing", async () => {
    for (const bad of ["", "not-a-jwt", "a.b.c"]) {
      expect(await verifyCriteriaUploadToken(bad)).toBeNull();
    }
  });
});
