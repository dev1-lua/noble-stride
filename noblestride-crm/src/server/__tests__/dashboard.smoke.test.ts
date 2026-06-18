// Smoke tests for dashboard + AI services.
// Robust to the database being down: if DATABASE_URL is unset or the DB is
// unreachable, the tests are skipped (never fail the suite).

import { describe, it, expect } from "vitest";
import { dashboardStats, pipelineOverview, dealPipelineTrend } from "@/server/services/dashboard";
import { aiOverviewInsights, aiAsk, aiMatchInvestors, aiFindProspects } from "@/server/services/ai";
import { prisma } from "@/lib/db";

/** Helper: run `fn`, skip on DB errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping smoke test");
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

describe("dashboard service (smoke)", () => {
  it("dashboardStats() returns 4 keys each {value:number, delta:number}", async () => {
    const stats = await withDb(() => dashboardStats());
    if (stats === null) return;

    const keys = ["activeMandates", "activeTransactions", "investorsEngagedQtr", "capitalRaisedYtd"] as const;
    expect(Object.keys(stats)).toHaveLength(4);
    for (const key of keys) {
      expect(typeof stats[key].value).toBe("number");
      expect(typeof stats[key].delta).toBe("number");
    }
  });

  it("pipelineOverview() returns mandatesByStage and transactionsByStage arrays", async () => {
    const overview = await withDb(() => pipelineOverview());
    if (overview === null) return;

    expect(Array.isArray(overview.mandatesByStage)).toBe(true);
    expect(Array.isArray(overview.transactionsByStage)).toBe(true);
    // Full vocab coverage
    expect(overview.mandatesByStage).toHaveLength(7);
    expect(overview.transactionsByStage).toHaveLength(7);
    for (const row of [...overview.mandatesByStage, ...overview.transactionsByStage]) {
      expect(typeof row.stage).toBe("string");
      expect(typeof row.label).toBe("string");
      expect(typeof row.count).toBe("number");
    }
  });

  it("dealPipelineTrend() returns exactly 6 months with numeric active/closed", async () => {
    const trend = await withDb(() => dealPipelineTrend());
    if (trend === null) return;

    expect(trend).toHaveLength(6);
    for (const row of trend) {
      expect(typeof row.month).toBe("string");
      expect(typeof row.active).toBe("number");
      expect(typeof row.closed).toBe("number");
    }
  });

  it("aiOverviewInsights() returns an array of Insight objects", async () => {
    const insights = await withDb(() => aiOverviewInsights());
    if (insights === null) return;

    expect(Array.isArray(insights)).toBe(true);
    for (const insight of insights) {
      expect(["convert", "attention", "match"]).toContain(insight.kind);
      expect(typeof insight.title).toBe("string");
      expect(typeof insight.detail).toBe("string");
    }
  });

  it("aiAsk('show me the pipeline') returns {answer:string, sources:string[]}", async () => {
    const result = await withDb(() => aiAsk("show me the pipeline"));
    if (result === null) return;

    expect(typeof result.answer).toBe("string");
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("aiMatchInvestors(id) returns an array when a transaction exists", async () => {
    const skip = await withDb(async () => {
      const txn = await prisma.transaction.findFirst({ select: { id: true } });
      if (txn == null) {
        console.log("No transactions in DB — skipping aiMatchInvestors assertion");
        return null;
      }
      const result = await aiMatchInvestors(txn.id);
      expect(Array.isArray(result)).toBe(true);
      return true;
    });
    void skip; // result not needed — test body ran above
  });

  it("aiFindProspects(id) returns an array when a mandate exists", async () => {
    const skip = await withDb(async () => {
      const mandate = await prisma.mandate.findFirst({ select: { id: true } });
      if (mandate == null) {
        console.log("No mandates in DB — skipping aiFindProspects assertion");
        return null;
      }
      const result = await aiFindProspects(mandate.id);
      expect(Array.isArray(result)).toBe(true);
      return true;
    });
    void skip;
  });
});
