import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { DEALS_SNAPSHOT } from "../../lib/queries";

const inputSchema = z.object({
  pipeline: z
    .enum(["mandates", "transactions", "both"])
    .default("both")
    .describe("Which pipeline to list; default both"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("How many deals to return, newest first (default 10)"),
});

interface SnapshotDeal {
  id: string;
  name: string;
  stage: string;
  dealStatus: string;
  createdAt: string;
  updatedAt: string;
  dateOpened?: string | null;
  currency?: string | null;
  dealSize?: number | null;
  targetRaise?: number | null;
  referredBy?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
}

interface Snapshot {
  mandatesByStage: Array<{ stage: string; label: string; items: SnapshotDeal[] }>;
  transactionsByStage: Array<{ stage: string; label: string; items: SnapshotDeal[] }>;
}

/** Newest first by when the deal was opened (falling back to record creation). */
function openedAt(deal: SnapshotDeal): number {
  return new Date(deal.dateOpened ?? deal.createdAt).getTime();
}

export class ListDealsTool implements LuaTool {
  name = "list_deals";
  description =
    "The latest/newest/most recent deals across BOTH pipelines (mandates and transactions), newest first, each with who introduced it (originating partner, or none on record). Use when asked about recent deals or to trace originators across several deals at once; get_referral_status is for ONE named deal.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const snapshot = await crm.query<Snapshot>(DEALS_SNAPSHOT);

    const rows: Array<{ type: "mandate" | "transaction"; deal: SnapshotDeal }> = [];
    if (input.pipeline !== "transactions") {
      for (const col of snapshot.mandatesByStage) for (const item of col.items) rows.push({ type: "mandate", deal: item });
    }
    if (input.pipeline !== "mandates") {
      for (const col of snapshot.transactionsByStage) for (const item of col.items) rows.push({ type: "transaction", deal: item });
    }
    rows.sort((a, b) => openedAt(b.deal) - openedAt(a.deal));

    const total = rows.length;
    const deals = rows.slice(0, input.limit).map(({ type, deal }) => ({
      name: deal.name,
      type,
      client: deal.client?.name ?? null,
      stage: deal.stage,
      dealStatus: deal.dealStatus,
      currency: deal.currency ?? null,
      // targetRaise on transactions, dealSize on mandates — one of the two is present.
      amount: deal.targetRaise ?? deal.dealSize ?? null,
      opened: deal.dateOpened ?? deal.createdAt,
      introducedBy: deal.referredBy ? { id: deal.referredBy.id, name: deal.referredBy.name } : null,
      link: `${crm.baseUrl}/${type === "mandate" ? "mandates" : "transactions"}/${deal.id}`,
    }));

    return { status: "ok" as const, totalDeals: total, showing: deals.length, deals };
  }
}
