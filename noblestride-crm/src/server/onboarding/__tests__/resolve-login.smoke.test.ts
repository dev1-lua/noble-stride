import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resolveLogin, isTeamEmail } from "@/server/onboarding/resolve-login";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

const UNIQ = `login-smoke-${Date.now()}`;
const INVESTOR_EMAIL = `contact@${UNIQ}-fund.example.com`;
const PARTNER_EMAIL = `contact@${UNIQ}-advisory.example.com`;
const BOTH_EMAIL = `both@${UNIQ}.example.com`;

let investorId: string | undefined;
let partnerId: string | undefined;

beforeAll(async () => {
  await withDb(async () => {
    const investor = await prisma.investor.create({
      data: { name: `Login Smoke Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "PendingReview" },
    });
    const partner = await prisma.partner.create({ data: { name: `Login Smoke Advisory ${UNIQ}` } });
    investorId = investor.id;
    partnerId = partner.id;
    await prisma.person.createMany({
      data: [
        { firstName: "Inge", email: INVESTOR_EMAIL, investorId: investor.id },
        { firstName: "Pat", email: PARTNER_EMAIL, partnerId: partner.id },
        // Same email on both an investor and a partner contact — investor must win.
        { firstName: "Bo", email: BOTH_EMAIL, investorId: investor.id },
        { firstName: "Bo", email: BOTH_EMAIL, partnerId: partner.id },
      ],
    });
    return true;
  });
});

afterAll(async () => {
  await withDb(async () => {
    await prisma.person.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
    await prisma.partner.deleteMany({ where: { name: { contains: UNIQ } } });
    return true;
  });
});

describe("isTeamEmail (pure)", () => {
  it("accepts noblestride domains, case-insensitively", () => {
    expect(isTeamEmail("jane@noblestride.co")).toBe(true);
    expect(isTeamEmail("Jane@NobleStride.com")).toBe(true);
    expect(isTeamEmail("ops@noblestride.co.ke")).toBe(true);
  });

  it("rejects everything else, including lookalikes", () => {
    expect(isTeamEmail("jane@gmail.com")).toBe(false);
    expect(isTeamEmail("jane@noblestride-capital.com")).toBe(false);
    expect(isTeamEmail("jane@notnoblestride.co")).toBe(false);
    expect(isTeamEmail("")).toBe(false);
  });
});

describe("resolveLogin (smoke)", () => {
  it("resolves an investor contact email to the investor viewpoint (case-insensitive)", async () => {
    const out = await withDb(async () => {
      const res = await resolveLogin(INVESTOR_EMAIL.toUpperCase());
      expect(res).toEqual({ kind: "investor", recordId: investorId });
      return true;
    });
    if (out === null) return; // DB down — skip
  });

  it("resolves a partner contact email to the partner viewpoint", async () => {
    const out = await withDb(async () => {
      const res = await resolveLogin(PARTNER_EMAIL);
      expect(res).toEqual({ kind: "partner", recordId: partnerId });
      return true;
    });
    if (out === null) return;
  });

  it("prefers investor over partner when the email matches both", async () => {
    const out = await withDb(async () => {
      const res = await resolveLogin(BOTH_EMAIL);
      expect(res).toEqual({ kind: "investor", recordId: investorId });
      return true;
    });
    if (out === null) return;
  });

  it("resolves a team-domain email to admin, and unknown emails to unknown", async () => {
    const out = await withDb(async () => {
      expect(await resolveLogin("jane@noblestride.co")).toEqual({ kind: "admin" });
      expect(await resolveLogin(`nobody@${UNIQ}.example.com`)).toEqual({ kind: "unknown" });
      expect(await resolveLogin("   ")).toEqual({ kind: "unknown" });
      return true;
    });
    if (out === null) return;
  });
});
