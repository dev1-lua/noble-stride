import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { PARTNER_REFERRAL_STATS } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";

const inputSchema = z.object({
  partner: z
    .string()
    .optional()
    .describe("Narrow to one partner — name as the user said it, or an exact id; omit for the firm-wide leaderboard"),
});

interface Stats {
  partnerReferralStats: {
    totalPartners: number;
    dealsReferred: number;
    closedRevenue: number;
    conversionRate: number;
    byPartner: Array<{ id: string; name: string; referred: number; active: number; closed: number; revenue: number }>;
  };
}

export class PartnerPerformanceTool implements LuaTool {
  name = "partner_performance";
  description =
    "Referral performance rollup: deals referred, still active, closed, revenue and conversion — firm-wide leaderboard across all partners, or one partner's numbers. Read-only.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();

    let partnerId: string | undefined;
    if (input.partner) {
      const resolution = await resolveByNameOrId(crm, "partner", input.partner);
      if (resolution.kind === "none") {
        return { status: "not_found" as const, message: `No partner matching "${input.partner}" was found in the CRM.` };
      }
      if (resolution.kind === "ambiguous") {
        return {
          status: "ambiguous" as const,
          message: "Multiple partners match — ask the user to pick one, then call again with the chosen id.",
          candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
        };
      }
      partnerId = resolution.result.id;
    }

    const stats = (await crm.query<Stats>(PARTNER_REFERRAL_STATS)).partnerReferralStats;

    if (partnerId) {
      const row = stats.byPartner.find((p) => p.id === partnerId);
      if (!row) {
        return { status: "not_found" as const, message: "The partner could not be loaded from the CRM stats." };
      }
      return {
        status: "ok" as const,
        partner: {
          id: row.id,
          name: row.name,
          referred: row.referred,
          active: row.active,
          closed: row.closed,
          revenue: row.revenue,
          conversionRate: row.referred > 0 ? row.closed / row.referred : 0,
        },
        link: `${crm.baseUrl}/partners/${row.id}`,
      };
    }

    return {
      status: "ok" as const,
      totals: {
        totalPartners: stats.totalPartners,
        dealsReferred: stats.dealsReferred,
        closedRevenue: stats.closedRevenue,
        conversionRate: stats.conversionRate,
      },
      leaderboard: [...stats.byPartner]
        .sort((a, b) => b.revenue - a.revenue || b.closed - a.closed || b.referred - a.referred)
        .map((p) => ({
          name: p.name,
          referred: p.referred,
          active: p.active,
          closed: p.closed,
          revenue: p.revenue,
          link: `${crm.baseUrl}/partners/${p.id}`,
        })),
      link: `${crm.baseUrl}/partners`,
    };
  }
}
