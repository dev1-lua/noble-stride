import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { PIPELINE_SNAPSHOT } from "../../lib/queries";
import { rosterByStage, type RosterStage } from "../../lib/analysis";

export interface ListDealsDeps {
  crm: CrmClient;
}

/** How many example names to show per stage in the default (all-stages) overview. */
export const ROSTER_NAME_CAP = 5;

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
    "List deals grouped by pipeline stage, with each deal's name, lead, and target value. Use when the user asks what deals exist in which stage. By DEFAULT (no stage filter) it returns a short overview: each stage's true total count plus the first few example names and a `remaining` count of names not shown — render that compactly, do not print every name. To get one stage's FULL name-by-name list, pass that stage in the `stage` filter (then every name in it is returned, remaining 0). Covers mandates (client acquisition), transactions (fundraising), or both. Facts only; never expose raw record ids.";
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

    // Default (all-stages) view stays scannable: show a few example names per
    // stage and how many are held back. A single-stage drill-down (stage filter
    // present) returns that stage in full so the reader gets every name.
    const capNames = !input.stage;
    const shaped = filtered.map((p) => ({
      pipeline: p.pipeline,
      stages: p.stages.map((s) => {
        const deals = capNames ? s.deals.slice(0, ROSTER_NAME_CAP) : s.deals;
        return { stage: s.stage, label: s.label, count: s.count, deals, remaining: s.count - deals.length };
      }),
    }));

    return { status: "ok" as const, pipelines: shaped };
  }
}
