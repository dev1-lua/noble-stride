import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { PIPELINE_SNAPSHOT } from "../../lib/queries";
import type { StageColumn } from "../../lib/format";

export interface ListDealsDeps {
  crm: CrmClient;
}

const inputSchema = z.object({
  pipeline: z
    .enum(["transactions", "mandates", "advisory", "all"])
    .default("transactions")
    .describe(
      "Which pipeline to list. Deals are transactions; mandates = client acquisition; advisory = advisory work (amount is the fee); all = every pipeline",
    ),
});

interface Snapshot {
  mandatesByStage: StageColumn[];
  transactionsByStage: StageColumn[];
  advisoryByStage: StageColumn[];
}

function toRoster(columns: StageColumn[], baseUrl: string, path: "transactions" | "mandates" | "advisory") {
  const stages = columns.map((col) => ({
    stage: col.stage,
    label: col.label,
    count: col.items.length,
    deals: col.items.map((item) => ({
      name: item.name,
      dateOpened: item.dateOpened ?? null,
      currency: item.currency ?? null,
      // targetRaise on transactions, dealSize on mandates, feeAmount on advisory.
      amount: item.targetRaise ?? item.dealSize ?? item.feeAmount ?? null,
      link: `${baseUrl}/${path}/${item.id}`,
    })),
  }));
  return { stages, totalCount: stages.reduce((s, c) => s + c.count, 0) };
}

export class ListDealsTool implements LuaTool {
  name = "list_deals";
  description =
    "Complete roster of every record in a pipeline — including Closed-Won, Closed-Lost, and on-hold — grouped by stage with names and links. Covers transactions (deals), mandates, and advisory engagements (amount = fee). Use when asked to list all deals; pipeline_digest is for what recently changed, not the full list.";
  inputSchema = inputSchema;

  constructor(private deps?: ListDealsDeps) {}

  private getDeps(): ListDealsDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm } = this.getDeps();
    const snapshot = await crm.query<Snapshot>(PIPELINE_SNAPSHOT);

    const pipelines = [];
    if (input.pipeline === "transactions" || input.pipeline === "all") {
      pipelines.push({ pipeline: "transactions" as const, ...toRoster(snapshot.transactionsByStage, crm.baseUrl, "transactions") });
    }
    if (input.pipeline === "mandates" || input.pipeline === "all") {
      pipelines.push({ pipeline: "mandates" as const, ...toRoster(snapshot.mandatesByStage, crm.baseUrl, "mandates") });
    }
    if (input.pipeline === "advisory" || input.pipeline === "all") {
      pipelines.push({ pipeline: "advisory" as const, ...toRoster(snapshot.advisoryByStage, crm.baseUrl, "advisory") });
    }

    return { status: "ok" as const, pipelines };
  }
}
