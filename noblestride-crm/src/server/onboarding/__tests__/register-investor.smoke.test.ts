import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { registerInvestor, confirmRegistrationOtp, DEMO_OTP, RegistrationError } from "@/server/onboarding/register-investor";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

const UNIQ = `smoke-${Date.now()}`;
const input = {
  fundName: `Smoke Fund ${UNIQ}`,
  contactPerson: "Ada Lovelace",
  email: `ada@${UNIQ}.example.com`,
  phone: "+254711111111",
  investorType: "PrivateEquity",
  sectorPreference: ["Technology"],
  dealType: "Equity",
  dealSizeBand: "1m-5m",
};

afterAll(async () => {
  await withDb(async () => {
    await prisma.activity.deleteMany({ where: { investor: { name: { contains: UNIQ } } } });
    await prisma.person.deleteMany({ where: { investor: { name: { contains: UNIQ } } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
    return true;
  });
});

describe("registerInvestor (smoke)", () => {
  it("creates a PendingReview investor with primary contact + activity", async () => {
    const out = await withDb(async () => {
      const investor = await registerInvestor(input);
      expect(investor.onboardingStatus).toBe("PendingReview");
      expect(investor.registeredAt).toBeInstanceOf(Date);
      expect(investor.createdSource).toBe("API");
      expect(Number(investor.ticketMin)).toBe(1_000_000);
      expect(Number(investor.ticketMax)).toBe(5_000_000);

      const contact = await prisma.person.findFirst({ where: { investorId: investor.id } });
      expect(contact?.isPrimaryContact).toBe(true);
      expect(contact?.firstName).toBe("Ada");
      expect(contact?.lastName).toBe("Lovelace");
      expect(contact?.email).toBe(input.email);

      const activity = await prisma.activity.findFirst({ where: { investorId: investor.id } });
      expect(activity?.subject).toContain("self-registered");
      return true;
    });
    if (out === null) return; // DB down — skip
  });

  it("rejects a duplicate contact email", async () => {
    const out = await withDb(async () => {
      await expect(registerInvestor({ ...input, fundName: `Other ${UNIQ}` })).rejects.toThrow(RegistrationError);
      return true;
    });
    if (out === null) return; // DB down — skip
  });

  it("confirmRegistrationOtp stamps verification with the demo code", async () => {
    const out = await withDb(async () => {
      const investor = await prisma.investor.findFirstOrThrow({ where: { name: { contains: UNIQ } } });
      await expect(confirmRegistrationOtp(investor.id, "123456", DEMO_OTP)).rejects.toThrow(RegistrationError);
      await confirmRegistrationOtp(investor.id, DEMO_OTP, DEMO_OTP);
      const updated = await prisma.investor.findUniqueOrThrow({ where: { id: investor.id } });
      expect(updated.emailVerifiedAt).toBeInstanceOf(Date);
      expect(updated.phoneVerifiedAt).toBeInstanceOf(Date);
      return true;
    });
    if (out === null) return; // DB down — skip
  });
});
