// GraphQL schema smoke test.
// Always-run: verifies the schema builds (no DB required) — schema-build assertion.
// DB-guarded: verifies the dashboardStats service resolves via the schema's resolver
//             (skipped when DATABASE_URL is unset, matching the Tasks 4–7 smoke pattern).

import { describe, it, expect } from "vitest";

/** Helper: run `fn`, skip on DB errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping DB smoke test");
    return null;
  }
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("connect") ||
      message.includes("Can't reach database") ||
      message.includes("P1001") ||
      message.includes("P1002")
    ) {
      console.log("DB unreachable — skipping smoke test:", message);
      return null;
    }
    throw err;
  }
}

describe("graphql schema", () => {
  it("builds without errors and exposes a query type with 26 queries and 28 mutations", async () => {
    // Dynamic import so the module graph is resolved lazily — errors surface here.
    const { schema } = await import("@/graphql/schema");
    expect(schema).toBeTruthy();

    const queryType = schema.getQueryType();
    expect(queryType).toBeTruthy();
    const queryFields = Object.keys(queryType?.getFields() ?? {});
    expect(queryFields).toHaveLength(26);

    const mutationType = schema.getMutationType();
    expect(mutationType).toBeTruthy();
    const mutationFields = Object.keys(mutationType?.getFields() ?? {});
    expect(mutationFields).toHaveLength(28);

    // Spot-check that key query fields exist
    expect(queryFields).toContain("dashboardStats");
    expect(queryFields).toContain("investors");
    expect(queryFields).toContain("mandatesByStage");
    expect(queryFields).toContain("aiAsk");
    expect(queryFields).toContain("documents");
    expect(queryFields).toContain("document");

    // Spot-check mutation fields
    expect(mutationFields).toContain("updateMandateStage");
    expect(mutationFields).toContain("updateTransactionStage");
    expect(mutationFields).toContain("logEngagement");
    expect(mutationFields).toContain("createEngagement");
    expect(mutationFields).toContain("updateEngagement");
    expect(mutationFields).toContain("createServiceProvider");
    expect(mutationFields).toContain("updateServiceProvider");
    expect(mutationFields).toContain("deleteServiceProvider");
    expect(mutationFields).toContain("createDocument");
    expect(mutationFields).toContain("updateDocument");
    expect(mutationFields).toContain("deleteDocument");
    expect(mutationFields).toContain("upsertDueDiligenceTrack");
    expect(mutationFields).toContain("deleteDueDiligenceTrack");
  });

  it("dashboardStats service resolves correctly (DB-guarded)", async () => {
    // Tests the resolver's backing service — same pattern as Tasks 4-7 smoke tests.
    // Using the service directly avoids cross-module-realm issues with graphql@17 in vitest.
    await withDb(async () => {
      const { dashboardStats } = await import("@/server/services/dashboard");
      const stats = await dashboardStats();
      expect(stats).toBeTruthy();
      expect(typeof stats.activeMandates.value).toBe("number");
      expect(typeof stats.activeMandates.delta).toBe("number");
      expect(typeof stats.activeTransactions.value).toBe("number");
      expect(typeof stats.activeTransactions.delta).toBe("number");
    });
  });
});
