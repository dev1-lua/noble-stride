import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { pendingOnboardingInvestors } from "@/server/services/dashboard";

// The fixture is `zz-` prefixed so the prefix sweep
// (scripts/cleanup-prefixed-test-data.ts) can find it if a run dies mid-test.
const UNIQ = `onboarding-queue-${Date.now()}`;

describe("pendingOnboardingInvestors", () => {
  it("returns only PendingReview investors with their primary contact", async () => {
    const email = `zz-pat-${UNIQ}@zzpendingfund.test`;
    const inv = await prisma.investor.create({
      data: {
        name: `zz-Pending Fund ${UNIQ}`,
        investorType: "PrivateEquity",
        onboardingStatus: "PendingReview",
        registeredAt: new Date(),
        contacts: { create: { firstName: "Pat", lastName: "Lee", email, isPrimaryContact: true } },
      },
    });
    try {
      const rows = await pendingOnboardingInvestors();
      const row = rows.find((r) => r.id === inv.id);
      expect(row).toBeTruthy();
      expect(row!.contactEmail).toBe(email);
      expect(row!.name).toBe(`zz-Pending Fund ${UNIQ}`);
    } finally {
      // The contact MUST go first and explicitly: Person.investorId is SetNull,
      // not Cascade, so deleting the investor alone orphans the contact rather
      // than removing it. Nine of these had accumulated in the restored dump
      // before it was noticed, and nothing could find them afterwards because an
      // orphan has no investor to match on.
      await prisma.person.deleteMany({ where: { investorId: inv.id } });
      await prisma.investor.delete({ where: { id: inv.id } });
    }
  });
});
