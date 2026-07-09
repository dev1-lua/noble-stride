// Onboarding decision smoke tests (approve / reject / greylist).
// Schema-level (always run, no DB): the exact documents the admin UI sends
// (components/crm/onboarding-actions.tsx) must validate against the schema —
// this is the regression that shipped as "GraphQL validation failed" when
// Investor.onboardingStatus was not exposed and greylist rode updateInvestor
// with a partial InvestorInput.
// DB-guarded: greylistInvestor service sets classification + resolves the
// registration and logs the decision on the timeline.

import { describe, it, expect, afterAll } from "vitest";
import { createRequire } from "node:module";

// Load graphql through CJS so validate/parse come from the SAME instance the
// schema was built with (pothos requires the CJS build; a bare ESM import here
// resolves the .mjs copy and validate() rejects the schema as another realm).
const { parse, validate } = createRequire(import.meta.url)("graphql") as typeof import("graphql");

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

const UNIQ = `greylist-smoke-${Date.now()}`;

afterAll(async () => {
  await withDb(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.activity.deleteMany({ where: { investor: { name: { contains: UNIQ } } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
    return true;
  });
});

// Keep these in sync with components/crm/onboarding-actions.tsx.
const SET_STATUS = `
  mutation SetOnboarding($id: ID!, $status: OnboardingStatus!) {
    setInvestorOnboardingStatus(id: $id, status: $status) { id onboardingStatus }
  }
`;
const GREYLIST = `
  mutation Greylist($id: ID!) {
    greylistInvestor(id: $id) { id onboardingStatus engagementClassification }
  }
`;

describe("onboarding decision documents validate against the schema", () => {
  it("exposes the onboarding fields on Investor", async () => {
    const { schema } = await import("@/graphql/schema");
    const investor = schema.getType("Investor");
    expect(investor).toBeTruthy();
    const fields = Object.keys((investor as import("graphql").GraphQLObjectType).getFields());
    for (const f of ["onboardingStatus", "registeredAt", "emailVerifiedAt", "phoneVerifiedAt", "engagementClassification"]) {
      expect(fields).toContain(f);
    }
  });

  it("accepts the exact admin-UI approve/reject and greylist documents", async () => {
    const { schema } = await import("@/graphql/schema");
    expect(validate(schema, parse(SET_STATUS))).toEqual([]);
    expect(validate(schema, parse(GREYLIST))).toEqual([]);
  });
});

describe("greylistInvestor service (DB-guarded)", () => {
  it("sets Greylisted + Rejected and logs the decision", async () => {
    await withDb(async () => {
      const { prisma } = await import("@/lib/db");
      const { greylistInvestor } = await import("@/server/services/investors");

      const created = await prisma.investor.create({
        data: { name: `Greylist Smoke Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "PendingReview" },
      });

      const updated = await greylistInvestor(created.id, { type: "HUMAN" });
      expect(updated.engagementClassification).toBe("Greylisted");
      expect(updated.onboardingStatus).toBe("Rejected");

      const activity = await prisma.activity.findFirst({
        where: { investorId: created.id, subject: { contains: "greylisted" } },
      });
      expect(activity).toBeTruthy();
      return true;
    });
  });
});
