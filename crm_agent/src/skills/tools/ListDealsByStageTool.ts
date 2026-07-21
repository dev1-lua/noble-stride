import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { PIPELINE_SNAPSHOT } from "../../lib/queries";
import { rosterByStage, type RosterStage } from "../../lib/analysis";

export interface ListDealsDeps {
  crm: CrmClient;
}

/** A stage column as returned by PIPELINE_SNAPSHOT; items carry name + owner/lead. */
interface SnapshotColumn {
  stage: string;
  label: string;
  items: Array<Record<string, unknown>>;
}

const inputSchema = z.object({
  pipeline: z
    .enum(["mandates", "transactions", "both"])
    .default("both")
    .describe("Which pipeline to roster: mandates (client acquisition), transactions (fundraising), or both."),
  stage: z
    .string()
    .optional()
    .describe("Optional single-stage filter, matched case-insensitively against the stage key or label. Omit to list every stage."),
});

export class ListDealsByStageTool implements LuaTool {
  name = "list_deals_by_stage";
  description =
    "List every deal grouped by pipeline stage, with each deal's name, lead, and target value. Use when the user asks what deals exist in which stage, or wants a full name-by-name roster across stages (not just totals or health). Covers mandates (client acquisition), transactions (fundraising), or both. Facts only; never expose raw record ids.";
  inputSchema = inputSchema;

  constructor(private deps?: ListDealsDeps) {}

  private getDeps(): ListDealsDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm } = this.getDeps();
    const snap = await crm.query<{ mandatesByStage: SnapshotColumn[]; transactionsByStage: SnapshotColumn[] }>(
      PIPELINE_SNAPSHOT,
    );

    const pipelines: Array<{ pipeline: "mandates" | "transactions"; stages: RosterStage[] }> = [];
    if (input.pipeline !== "transactions") {
      pipelines.push({ pipeline: "mandates", stages: rosterByStage(snap.mandatesByStage ?? [], "mandate") });
    }
    if (input.pipeline !== "mandates") {
      pipelines.push({ pipeline: "transactions", stages: rosterByStage(snap.transactionsByStage ?? [], "transaction") });
    }

    // Optional single-stage filter (case-insensitive on stage key OR label).
    const filtered = input.stage
      ? pipelines.map((p) => {
          const needle = input.stage!.trim().toLowerCase();
          return {
            pipeline: p.pipeline,
            stages: p.stages.filter((s) => s.stage.toLowerCase() === needle || s.label.toLowerCase() === needle),
          };
        })
      : pipelines;

    const totalDeals = filtered.reduce((n, p) => n + p.stages.reduce((m, s) => m + s.count, 0), 0);
    if (totalDeals === 0) {
      return { status: "empty" as const };
    }

    return { status: "ok" as const, pipelines: filtered };
  }
}
