import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { resolveByNameOrId } from "../../lib/record-lookup";
import { scanReferredDeals, type ReferredDeal } from "../../lib/referral-scan";

const DAY_MS = 86_400_000;

const inputSchema = z.object({
  partner: z
    .string()
    .optional()
    .describe("Scope the digest to one partner — name as the user said it, or an exact id"),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Only include deals updated in the last N days; omit for all referred deals"),
});

export interface DigestDeps {
  crm: CrmClient;
  now?: () => Date;
}

export class ReferralPipelineDigestTool implements LuaTool {
  name = "referral_pipeline_digest";
  description =
    "Digest of every referred deal in the pipeline, grouped by introducing partner: stage, status, conversion, deep links. Optionally scoped to one partner and/or to deals updated in the last N days.";
  inputSchema = inputSchema;

  constructor(private deps?: DigestDeps) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const deps = this.deps ?? { crm: crmClientFromEnv() };
    const { crm } = deps;
    const now = deps.now ? deps.now() : new Date();

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

    let deals = await scanReferredDeals(crm);
    if (partnerId) deals = deals.filter((d) => d.partnerId === partnerId);
    if (input.days !== undefined) {
      const cutoff = now.getTime() - input.days * DAY_MS;
      deals = deals.filter((d) => d.updatedAt && new Date(d.updatedAt).getTime() >= cutoff);
    }

    const byPartner = new Map<string, { partner: string; deals: ReferredDeal[] }>();
    for (const deal of deals) {
      const group = byPartner.get(deal.partnerId) ?? { partner: deal.partnerName, deals: [] };
      group.deals.push(deal);
      byPartner.set(deal.partnerId, group);
    }

    return {
      status: "ok" as const,
      windowDays: input.days ?? null,
      totals: {
        referredDeals: deals.length,
        converted: deals.filter((d) => d.converted).length,
        lost: deals.filter((d) => d.lost).length,
        partners: byPartner.size,
      },
      byPartner: [...byPartner.entries()].map(([id, group]) => ({
        partnerId: id,
        partner: group.partner,
        counts: {
          referred: group.deals.length,
          converted: group.deals.filter((d) => d.converted).length,
          lost: group.deals.filter((d) => d.lost).length,
        },
        deals: group.deals.map((d) => ({
          name: d.dealName,
          type: d.dealType,
          stage: d.stage,
          dealStatus: d.dealStatus,
          converted: d.converted,
          lost: d.lost,
          link: `${crm.baseUrl}${d.link}`,
        })),
      })),
    };
  }
}
