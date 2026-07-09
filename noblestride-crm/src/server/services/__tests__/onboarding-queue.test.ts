import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { pendingOnboardingInvestors } from "@/server/services/dashboard";

describe("pendingOnboardingInvestors", () => {
  it("returns only PendingReview investors with their primary contact", async () => {
    const inv = await prisma.investor.create({
      data: {
        name: "Pending Fund", investorType: "PrivateEquity",
        onboardingStatus: "PendingReview", registeredAt: new Date(),
        contacts: { create: { firstName: "Pat", lastName: "Lee", email: "pat@pendingfund.com", isPrimaryContact: true } },
      },
    });
    const rows = await pendingOnboardingInvestors();
    const row = rows.find((r) => r.id === inv.id);
    expect(row).toBeTruthy();
    expect(row!.contactEmail).toBe("pat@pendingfund.com");
    expect(row!.name).toBe("Pending Fund");
    // cleanup
    await prisma.investor.delete({ where: { id: inv.id } });
  });
});
