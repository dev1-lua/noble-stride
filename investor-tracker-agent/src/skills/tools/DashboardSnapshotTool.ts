import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { DASHBOARD_SNAPSHOT } from "../../lib/queries";

export interface DashboardSnapshotDeps {
  crm: CrmClient;
}

interface StatValue {
  value: number;
  delta: number;
}

interface StageCount {
  stage: string;
  label: string;
  count: number;
}

interface Snapshot {
  dashboardStats: {
    activeMandates: StatValue;
    activeTransactions: StatValue;
    investorsEngagedQtr: StatValue;
    capitalRaisedYtd: StatValue;
  };
  pipelineOverview: {
    mandatesByStage: StageCount[];
    transactionsByStage: StageCount[];
  };
  dealPipelineTrend: Array<{ month: string; active: number; closed: number }>;
}

export class DashboardSnapshotTool implements LuaTool {
  name = "dashboard_snapshot";
  description =
    "Org-wide KPI snapshot: active mandates and transactions, investors engaged this quarter, capital raised YTD (each with its 30-day delta), pipeline counts by stage, and the 6-month active/closed deal trend. Use for top-line numbers; pipeline_digest is for what changed.";
  inputSchema = z.object({});

  constructor(private deps?: DashboardSnapshotDeps) {}

  private getDeps(): DashboardSnapshotDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(_input: Record<string, never>) {
    const { crm } = this.getDeps();
    const snapshot = await crm.query<Snapshot>(DASHBOARD_SNAPSHOT);

    return {
      status: "ok" as const,
      kpis: snapshot.dashboardStats,
      pipeline: snapshot.pipelineOverview,
      trend: snapshot.dealPipelineTrend,
      link: `${crm.baseUrl}/dashboard`,
    };
  }
}
