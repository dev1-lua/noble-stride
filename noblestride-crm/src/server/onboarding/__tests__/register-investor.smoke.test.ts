import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { registerInvestorWithAccount, RegistrationError } from "@/server/onboarding/register-investor";
import { greylistInvestor } from "@/server/services/investors";

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
const FIXTURE_EMAIL = `ada@${UNIQ}.example.com`;
const input = {
  fundName: `Smoke Fund ${UNIQ}`,
  contactPerson: "Ada Lovelace",
  email: FIXTURE_EMAIL,
  phone: "+254711111111",
  investorType: "PrivateEquity",
  sectorPreference: ["Technology"],
  geographicFocus: ["EastAfrica"],
  dealTypes: ["Equity"],
  ticketMin: "1000000",
  ticketMax: "5000000",
  currency: "USD",
  password: "long-enough-pass-1",
  confirmPassword: "long-enough-pass-1",
};

afterAll(async () => {
  await withDb(async () => {
    await prisma.authAccount.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.activity.deleteMany({ where: { investor: { name: { contains: UNIQ } } } });
    await prisma.person.deleteMany({ where: { investor: { name: { contains: UNIQ } } } });
    await prisma.blockedRegistration.deleteMany({ where: { reason: { contains: UNIQ } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
    return true;
  });
});

describe("registerInvestorWithAccount (smoke)", () => {
  it("creates a PendingReview investor with primary contact + activity + PENDING auth account", async () => {
    const out = await withDb(async () => {
      const investor = await registerInvestorWithAccount(input);
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

      const account = await prisma.authAccount.findUnique({ where: { email: FIXTURE_EMAIL.toLowerCase() } });
      expect(account?.status).toBe("PENDING");
      expect(account?.kind).toBe("INVESTOR");
      expect(account?.personId).toBe(contact?.id);
      expect(account?.passwordHash).not.toBe(input.password);
      return true;
    });
    if (out === null) return; // DB down — skip
  });

  it("rejects a duplicate contact email", async () => {
    const out = await withDb(async () => {
      await expect(
        registerInvestorWithAccount({ ...input, fundName: `Other ${UNIQ}` }),
      ).rejects.toThrow(RegistrationError);
      return true;
    });
    if (out === null) return; // DB down — skip
  });
});

describe("registerInvestorWithAccount — greylist domain block", () => {
  it("blocks re-registration on the whole domain after a corporate-email greylist", async () => {
    const out = await withDb(async () => {
      const domain = `brokers-${UNIQ}.example.com`;
      const first = await registerInvestorWithAccount({
        ...input,
        fundName: `Broker One ${UNIQ}`,
        email: `jane@${domain}`,
      });
      await greylistInvestor(first.id, { type: "HUMAN" });

      // a DIFFERENT address on the SAME domain is now barred at registration
      await expect(
        registerInvestorWithAccount({ ...input, fundName: `Broker Two ${UNIQ}`, email: `bob@${domain}` }),
      ).rejects.toThrow(RegistrationError);
      return true;
    });
    if (out === null) return; // DB down — skip
  });

  it("records an exact-email block (not a domain block) when greylisting a free-provider contact", async () => {
    const out = await withDb(async () => {
      const email = `greylist-${UNIQ}@gmail.com`;
      // Gmail can't self-register (schema rejects free providers) — create directly.
      const inv = await prisma.investor.create({
        data: {
          name: `Gmail Broker ${UNIQ}`,
          investorType: "PrivateEquity",
          onboardingStatus: "PendingReview",
          contacts: { create: { firstName: "Gil", email, isPrimaryContact: true } },
        },
      });
      await greylistInvestor(inv.id, { type: "HUMAN" });

      // Scoped to this investor: `reason` alone is ambiguous here — the sibling
      // domain-block test above also stamps a reason containing UNIQ.
      const block = await prisma.blockedRegistration.findFirst({ where: { investorId: inv.id } });
      expect(block?.kind).toBe("Email");
      expect(block?.value).toBe(email);
      return true;
    });
    if (out === null) return; // DB down — skip
  });
});
