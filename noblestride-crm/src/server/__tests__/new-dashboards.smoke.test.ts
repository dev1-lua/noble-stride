// Shape-level smoke test for the spec §13 pass-2 dashboard functions.

import { describe, it, expect } from "vitest";
import {
  pipelineActiveSplit,
  stageChangeFeed,
  stageChangeCounts,
  investorEngagementRollup,
  investedSummary,
  historicalEngagementSummary,
  partnerConversionFunnel,
} from "@/server/services/dashboard";

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

describe("pass-2 dashboards (smoke)", () => {
  it("returns well-formed aggregates", async () => {
    const out = await withDb(async () => {
      const split = await pipelineActiveSplit();
      expect(split.mandates.active).toBeGreaterThanOrEqual(0);
      expect(split.transactions.inactive).toBeGreaterThanOrEqual(0);

      const feed = await stageChangeFeed(5);
      expect(feed.length).toBeLessThanOrEqual(5);
      for (const item of feed) {
        expect(typeof item.field).toBe("string");
        expect(typeof item.entityLabel).toBe("string");
      }

      const counts = await stageChangeCounts();
      for (const c of counts) {
        expect(c.count).toBeGreaterThan(0);
        expect(typeof c.label).toBe("string");
      }

      const rollup = await investorEngagementRollup(5);
      for (const row of rollup) {
        expect(row.underReview + row.rejected + row.invested).toBeGreaterThan(0);
      }

      const invested = await investedSummary();
      expect(invested.count).toBeGreaterThanOrEqual(0);
      expect(invested.totalDisbursed).toBeGreaterThanOrEqual(0);

      const history = await historicalEngagementSummary();
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1], cur = history[i];
        expect(prev.year * 10 + prev.quarter).toBeLessThan(cur.year * 10 + cur.quarter);
      }

      const funnel = await partnerConversionFunnel();
      for (const row of funnel) {
        expect(row.introduced).toBeGreaterThanOrEqual(row.won + row.lost);
      }
      return true;
    });
    if (out === null) return;
  });
});
