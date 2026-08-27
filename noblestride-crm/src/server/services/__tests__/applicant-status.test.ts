// The applicant-status session token (F2.4 / G1). Pure: no DB, so every way a
// token can be wrong is covered cheaply. The OTP state machine itself is
// DB-bound and lives in applicant-status.smoke.test.ts — the codebase has no
// vi.mock("@/lib/db") precedent and this is not the place to introduce one.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SignJWT } from "jose";
import { verifyApplicantToken, APPLICANT_TOKEN_TTL_S } from "../applicant-status";

const PRIOR = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "zz-test-applicant-secret-0123456789ab";
});
afterAll(() => {
  if (PRIOR === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = PRIOR;
});

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);
const mint = (claims: Record<string, unknown>, exp: string) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(secret());

describe("verifyApplicantToken", () => {
  it("accepts a well-formed applicant-status token", async () => {
    const t = await mint({ email: "c@co.test", purpose: "applicant-status" }, `${APPLICANT_TOKEN_TTL_S}s`);
    expect(await verifyApplicantToken(t)).toEqual({ email: "c@co.test" });
  });

  it("rejects a token minted for a different purpose", async () => {
    // The client-status flow signs with the same secret; its tokens must not
    // open application tracking.
    const t = await mint({ email: "c@co.test", purpose: "client-status" }, "900s");
    expect(await verifyApplicantToken(t)).toBeNull();
  });

  it("rejects a missing email claim, an expired token and a tampered signature", async () => {
    expect(await verifyApplicantToken(await mint({ purpose: "applicant-status" }, "900s"))).toBeNull();
    expect(
      await verifyApplicantToken(await mint({ email: "c@co.test", purpose: "applicant-status" }, "-1s")),
    ).toBeNull();
    const good = await mint({ email: "c@co.test", purpose: "applicant-status" }, "900s");
    expect(await verifyApplicantToken(good.slice(0, -2) + "xy")).toBeNull();
  });

  it("rejects garbage without throwing", async () => {
    for (const bad of ["", "not-a-jwt", "a.b.c"]) {
      expect(await verifyApplicantToken(bad)).toBeNull();
    }
  });
});
