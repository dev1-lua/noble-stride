// Dashboard → deals drilldown parity (DB-guarded, matching the smoke pattern):
// every Pipeline Breakdown number must equal the row count of the /deals view
// its drilldown link opens. Guards the sector-source and ticket-band
// unification (dashboard.ts pipelineBreakdowns vs deals-queue loadRows).

import { describe, it, expect } from "vitest";
import { ACTIVE_TXN_STAGES } from "@/server/domain/types";
import { parseDealsQuery } from "@/server/domain/deals-queue";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping DB smoke test");
    return null;
  }
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ECONNREFUSED") || message.includes("Can't reach database") || message.includes("P1001")) {
      console.log("DB unreachable — skipping smoke test:", message);
      return null;
    }
    throw err;
  }
}

const ACTIVE = ACTIVE_TXN_STAGES.join(",");

describe("dashboard drilldown parity", () => {
  it("breakdown counts equal the filtered deals-list totals their links open", async () => {
    await withDb(async () => {
      const { pipelineBreakdowns } = await import("@/server/services/dashboard");
      const { listAllDeals } = await import("@/server/services/deals-queue");
      const breakdowns = await pipelineBreakdowns();

      const countFor = async (extra: Record<string, string>) =>
        (await listAllDeals(parseDealsQuery({ type: "transaction", stage: ACTIVE, ...extra }))).total;

      for (const row of breakdowns.bySector) {
        expect({ dim: "sector", key: row.key, count: await countFor({ sector: row.key }) })
          .toEqual({ dim: "sector", key: row.key, count: row.count });
      }
      for (const row of breakdowns.byTicketBand) {
        if (row.key === "none") continue; // "Not set" rows carry no drilldown
        expect({ dim: "ticket", key: row.key, count: await countFor({ ticket: row.key }) })
          .toEqual({ dim: "ticket", key: row.key, count: row.count });
      }
      for (const row of breakdowns.byLead) {
        if (row.key === "unassigned" || row.label === "Unknown") continue;
        expect({ dim: "lead", key: row.label, count: await countFor({ lead: row.label }) })
          .toEqual({ dim: "lead", key: row.label, count: row.count });
      }
      for (const row of breakdowns.byFinancingType) {
        if (row.key === "none") continue;
        expect({ dim: "financing", key: row.key, count: await countFor({ financing: row.key }) })
          .toEqual({ dim: "financing", key: row.key, count: row.count });
      }

      // Top stat cards: active mandates / active transactions.
      const { dashboardStats } = await import("@/server/services/dashboard");
      const { ACTIVE_MANDATE_STAGES } = await import("@/server/domain/types");
      const stats = await dashboardStats();
      const mandateTotal = (await listAllDeals(parseDealsQuery({ type: "mandate", stage: ACTIVE_MANDATE_STAGES.join(",") }))).total;
      const txnTotal = (await listAllDeals(parseDealsQuery({ type: "transaction", stage: ACTIVE }))).total;
      expect(mandateTotal).toBe(stats.activeMandates.value);
      expect(txnTotal).toBe(stats.activeTransactions.value);
    });
  });
});
