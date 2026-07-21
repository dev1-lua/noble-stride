import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { ENGAGEMENT_TRACKER_DETAIL, ENGAGEMENTS_BY_DEAL_SCAN, PIPELINE_SNAPSHOT } from "../../lib/queries";
import { resolveEngagement } from "../../lib/engagement-resolve";
import { resolveByNameOrId } from "../../lib/record-lookup";

export interface DisbursementDeps {
  crm: CrmClient;
}

const inputSchema = z.object({
  investor: z
    .string()
    .optional()
    .describe("Investor name (or exact id) — supply with `deal` for a single investor's disbursement on that deal"),
  deal: z
    .string()
    .optional()
    .describe(
      "Transaction/deal name (or exact id). With `investor`, one engagement; alone, a roll-up across every investor on the deal",
    ),
  engagementId: z
    .string()
    .optional()
    .describe("Skip name resolution for a single engagement when a previous call returned its id"),
});

interface SingleDetail {
  engagement: {
    id: string;
    name: string;
    totalAmount?: number | null;
    amountDisbursed?: number | null;
    amountPending?: number | null;
    disbursementStatus?: string | null;
    dateReceived?: string | null;
    transaction: { id: string; name: string };
    investor: { id: string; name: string };
  } | null;
}

interface DealScan {
  engagementsByDeal: Array<{
    transaction: { id: string; name: string; stage: string; dealStatus: string };
    engagements: Array<{
      id: string;
      investor: { id: string; name: string };
      totalAmount?: number | null;
      amountDisbursed?: number | null;
      amountPending?: number | null;
      disbursementStatus?: string | null;
    }>;
  }>;
}

const n = (v: number | null | undefined): number => (typeof v === "number" ? v : 0);

type ScanRow = DealScan["engagementsByDeal"][number];

function dealTotals(engagements: ScanRow["engagements"]) {
  return {
    total: engagements.reduce((s, e) => s + n(e.totalAmount), 0),
    disbursed: engagements.reduce((s, e) => s + n(e.amountDisbursed), 0),
    pending: engagements.reduce((s, e) => s + n(e.amountPending), 0),
    engagementCount: engagements.length,
  };
}

function statusHistogram(engagements: ScanRow["engagements"]) {
  const byStatus: Record<string, number> = {};
  for (const eng of engagements) {
    const key = eng.disbursementStatus ?? "Unspecified";
    byStatus[key] = (byStatus[key] ?? 0) + 1;
  }
  return byStatus;
}

export class DisbursementSummaryTool implements LuaTool {
  name = "disbursement_summary";
  description =
    "Disbursement figures (§3.11): total committed, disbursed, and pending. For ONE investor on a deal, pass engagementId or investor + deal. For a whole deal's roll-up across every investor, pass deal alone. Pass nothing for a portfolio-wide roll-up across every deal at once. Numbers are internal — never share them outside Noblestride.";
  inputSchema = inputSchema;

  constructor(private deps?: DisbursementDeps) {}

  private getDeps(): DisbursementDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm } = this.getDeps();

    // Single-engagement mode: an explicit id, or investor + deal together.
    if (input.engagementId || (input.investor && input.deal)) {
      return this.single(crm, input);
    }
    // Deal roll-up mode: a deal on its own.
    if (input.deal && !input.investor) {
      return this.dealRollup(crm, input.deal);
    }
    if (input.investor && !input.deal) {
      return {
        status: "rejected" as const,
        message: "An investor alone isn't enough — pass investor + deal for one engagement, deal alone for a deal roll-up, or nothing for the whole portfolio.",
      };
    }
    // No identifying args: portfolio-wide roll-up across every deal.
    return this.allDeals(crm);
  }

  private async single(crm: CrmClient, input: z.infer<typeof inputSchema>) {
    let engagementId = input.engagementId;
    if (!engagementId) {
      const resolution = await resolveEngagement(crm, input.investor!, input.deal!);
      if (resolution.kind !== "ok") {
        if (resolution.kind === "no_engagement") {
          return {
            status: "no_engagement" as const,
            message: `${resolution.investor.name} has no engagement on ${resolution.transaction.name}.`,
          };
        }
        if (resolution.kind === "ambiguous_investor" || resolution.kind === "ambiguous_deal") {
          return {
            status: resolution.kind,
            message: "Multiple records match — ask the user to pick one, then call again with the chosen id.",
            candidates: resolution.candidates,
          };
        }
        return { status: resolution.kind, message: "No matching record was found in the CRM." };
      }
      engagementId = resolution.engagementId;
    }

    const detail = await crm.query<SingleDetail>(ENGAGEMENT_TRACKER_DETAIL, { id: engagementId });
    const e = detail.engagement;
    if (!e) return { status: "not_found" as const, message: "The engagement could not be loaded from the CRM." };

    return {
      status: "ok" as const,
      mode: "engagement" as const,
      engagement: { id: e.id, name: e.name },
      investor: { id: e.investor.id, name: e.investor.name },
      deal: { id: e.transaction.id, name: e.transaction.name },
      amounts: {
        total: e.totalAmount ?? null,
        disbursed: e.amountDisbursed ?? null,
        pending: e.amountPending ?? null,
        disbursementStatus: e.disbursementStatus ?? null,
        dateReceived: e.dateReceived ?? null,
      },
      link: `${crm.baseUrl}/engagement/${e.id}`,
    };
  }

  private async dealRollup(crm: CrmClient, dealQuery: string) {
    const dealRes = await resolveByNameOrId(crm, "transaction", dealQuery);
    if (dealRes.kind === "none") {
      return { status: "deal_not_found" as const, message: "No matching deal was found in the CRM." };
    }
    if (dealRes.kind === "ambiguous") {
      return {
        status: "ambiguous_deal" as const,
        message: "Multiple deals match — ask the user to pick one, then call again with the chosen id.",
        candidates: dealRes.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const dealId = dealRes.result.id;
    const scan = await crm.query<DealScan>(ENGAGEMENTS_BY_DEAL_SCAN);
    const row = scan.engagementsByDeal.find((r) => r.transaction.id === dealId);
    if (!row) {
      return {
        status: "no_engagement" as const,
        message: `${dealRes.result.title} has no investor engagements yet, so there is nothing to disburse.`,
      };
    }

    const perInvestor = row.engagements.map((eng) => ({
      investor: { id: eng.investor.id, name: eng.investor.name },
      total: eng.totalAmount ?? null,
      disbursed: eng.amountDisbursed ?? null,
      pending: eng.amountPending ?? null,
      disbursementStatus: eng.disbursementStatus ?? null,
    }));

    return {
      status: "ok" as const,
      mode: "deal" as const,
      deal: {
        id: row.transaction.id,
        name: row.transaction.name,
        stage: row.transaction.stage,
        dealStatus: row.transaction.dealStatus,
      },
      totals: dealTotals(row.engagements),
      byStatus: statusHistogram(row.engagements),
      engagements: perInvestor,
      link: `${crm.baseUrl}/transactions/${row.transaction.id}`,
    };
  }

  /**
   * Portfolio-wide roll-up. Deals with zero engagements have nothing to disburse,
   * so they carry no figures — but they are still listed (dealsWithoutEngagements)
   * so the roll-up visibly covers every deal in the CRM.
   */
  private async allDeals(crm: CrmClient) {
    const [scan, snapshot] = await Promise.all([
      crm.query<DealScan>(ENGAGEMENTS_BY_DEAL_SCAN),
      crm.query<{ transactionsByStage: Array<{ label: string; items: Array<{ id: string; name: string }> }> }>(
        PIPELINE_SNAPSHOT,
      ),
    ]);

    const engagedIds = new Set(scan.engagementsByDeal.map((r) => r.transaction.id));
    const dealsWithoutEngagements = snapshot.transactionsByStage.flatMap((col) =>
      col.items
        .filter((item) => !engagedIds.has(item.id))
        .map((item) => ({
          name: item.name,
          stage: col.label,
          link: `${crm.baseUrl}/transactions/${item.id}`,
        })),
    );

    const deals = scan.engagementsByDeal
      .map((row) => ({
        deal: {
          name: row.transaction.name,
          stage: row.transaction.stage,
          dealStatus: row.transaction.dealStatus,
        },
        totals: dealTotals(row.engagements),
        byStatus: statusHistogram(row.engagements),
        link: `${crm.baseUrl}/transactions/${row.transaction.id}`,
      }))
      .sort((a, b) => b.totals.disbursed - a.totals.disbursed);

    return {
      status: "ok" as const,
      mode: "all_deals" as const,
      deals,
      dealsWithoutEngagements,
      grandTotals: {
        total: deals.reduce((s, d) => s + d.totals.total, 0),
        disbursed: deals.reduce((s, d) => s + d.totals.disbursed, 0),
        pending: deals.reduce((s, d) => s + d.totals.pending, 0),
        engagementCount: deals.reduce((s, d) => s + d.totals.engagementCount, 0),
        dealCount: deals.length,
        dealsWithoutEngagementsCount: dealsWithoutEngagements.length,
      },
      note:
        dealsWithoutEngagements.length > 0
          ? `${dealsWithoutEngagements.length} deal(s) have no investor engagements yet, so no disbursement data exists for them — listed in dealsWithoutEngagements.`
          : null,
    };
  }
}
