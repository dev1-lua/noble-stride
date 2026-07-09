// Focused service-level test for the Task 2 exclusion filter on aiMatchInvestors:
// only investors with engagementClassification "Active" AND onboardingStatus
// "Approved" should ever be scored/returned, regardless of how well their
// profile otherwise matches the transaction.
//
// Robust to the database being down: if DATABASE_URL is unset or the DB is
// unreachable, the test is skipped (never fails the suite) — mirrors the
// src/server/__tests__/*.smoke.test.ts pattern (see transactions-crud.smoke.test.ts).

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { aiMatchInvestors } from "@/server/services/ai";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("aiMatchInvestors — engagementClassification/onboardingStatus exclusion filter", () => {
  it("only scores investors that are Active + Approved, excluding all others", async () => {
    const out = await withDb(async () => {
      const client = await prisma.client.create({
        data: { name: "__ai_match_client__", sector: ["Technology"], countries: ["EastAfrica"] },
      });
      const txn = await prisma.transaction.create({
        data: { name: "__ai_match_txn__", clientId: client.id, sector: ["Technology"] },
      });

      const shared = {
        investorType: "PrivateEquity" as const,
        sectorFocus: ["Technology" as const],
        geographicFocus: ["EastAfrica" as const],
      };

      const included = await prisma.investor.create({
        data: {
          ...shared,
          name: "__ai_match_included__",
          engagementClassification: "Active",
          onboardingStatus: "Approved",
        },
      });
      const excludedByClassification = await prisma.investor.create({
        data: {
          ...shared,
          name: "__ai_match_excluded_classification__",
          engagementClassification: "Excluded",
          onboardingStatus: "Approved",
        },
      });
      const excludedByOnboarding = await prisma.investor.create({
        data: {
          ...shared,
          name: "__ai_match_excluded_onboarding__",
          engagementClassification: "Active",
          onboardingStatus: "PendingReview",
        },
      });

      try {
        const matches = await aiMatchInvestors(txn.id);
        const ids = matches.map((m) => m.id);

        // Positive control: the eligible investor is actually scored, so the
        // absence of the other two below is evidence of filtering, not of
        // aiMatchInvestors returning nothing at all.
        expect(ids).toContain(included.id);
        expect(ids).not.toContain(excludedByClassification.id);
        expect(ids).not.toContain(excludedByOnboarding.id);
      } finally {
        await prisma.investor.deleteMany({
          where: { id: { in: [included.id, excludedByClassification.id, excludedByOnboarding.id] } },
        });
        await prisma.transaction.delete({ where: { id: txn.id } });
        await prisma.client.delete({ where: { id: client.id } });
      }
      return true;
    });
    if (out === null) return;
  });
});
