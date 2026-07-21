import { describe, it, expect, vi } from "vitest";
import { DashboardSnapshotTool } from "../DashboardSnapshotTool";
import type { CrmClient } from "../../../lib/crm-client";

const SNAPSHOT = {
  dashboardStats: {
    activeMandates: { value: 4, delta: 1 },
    activeTransactions: { value: 8, delta: -1 },
    investorsEngagedQtr: { value: 21, delta: 5 },
    capitalRaisedYtd: { value: 43_000_000, delta: 12_000_000 },
  },
  pipelineOverview: {
    mandatesByStage: [{ stage: "Signed", label: "Signed", count: 2 }],
    transactionsByStage: [{ stage: "DueDiligence", label: "Due Diligence", count: 3 }],
  },
  dealPipelineTrend: [
    { month: "Jun", active: 9, closed: 1 },
    { month: "Jul", active: 8, closed: 2 },
  ],
};

describe("DashboardSnapshotTool", () => {
  it("returns KPIs, stage counts, and trend with a dashboard link", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async (document: string) => {
        if (document.includes("TrackerDashboardSnapshot")) return SNAPSHOT;
        throw new Error(`unexpected document: ${document.slice(0, 60)}`);
      }) as CrmClient["query"],
    };
    const out = await new DashboardSnapshotTool({ crm }).execute({});
    expect(out.status).toBe("ok");
    expect(out.kpis.capitalRaisedYtd).toEqual({ value: 43_000_000, delta: 12_000_000 });
    expect(out.pipeline.transactionsByStage[0]).toMatchObject({ label: "Due Diligence", count: 3 });
    expect(out.trend).toHaveLength(2);
    expect(out.link).toBe("https://crm.example/dashboard");
  });
});
