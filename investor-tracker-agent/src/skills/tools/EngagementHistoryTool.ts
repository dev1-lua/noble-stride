import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { ENGAGEMENT_STAGE_HISTORY } from "../../lib/queries";
import { resolveEngagement } from "../../lib/engagement-resolve";

export interface EngagementHistoryDeps {
  crm: CrmClient;
}

const inputSchema = z.object({
  investor: z
    .string()
    .optional()
    .describe("Investor name as the user said it, or an exact id from a previous candidates list"),
  deal: z
    .string()
    .optional()
    .describe("Transaction/deal name as the user said it, or an exact id from a previous candidates list"),
  engagementId: z
    .string()
    .optional()
    .describe("Skip name resolution when a previous call already returned the engagement id"),
  allFields: z
    .boolean()
    .optional()
    .describe("Default false = stage moves only. Set true to include every tracked field's transitions."),
});

interface HistoryDetail {
  engagement: {
    id: string;
    name: string;
    engagementStage: string;
    transaction: { id: string; name: string };
    investor: { id: string; name: string };
    stageChanges: Array<{
      field: string;
      fromValue?: string | null;
      toValue: string;
      changedAt: string;
      createdSource: string;
      changedBy?: { id: string; name: string } | null;
    }>;
  } | null;
}

export class EngagementHistoryTool implements LuaTool {
  name = "engagement_history";
  description =
    "The stage-change timeline for one investor's engagement (§7.1): each transition from → to, when it happened, whether a person or automation made it, and who. Defaults to stage moves only; set allFields to see every tracked transition. Identify by engagementId or by investor + deal names.";
  inputSchema = inputSchema;

  constructor(private deps?: EngagementHistoryDeps) {}

  private getDeps(): EngagementHistoryDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm } = this.getDeps();

    let engagementId = input.engagementId;
    if (!engagementId) {
      if (!input.investor || !input.deal) {
        return {
          status: "rejected" as const,
          message: "Provide either engagementId, or both investor and deal names.",
        };
      }
      const resolution = await resolveEngagement(crm, input.investor, input.deal);
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

    const detail = await crm.query<HistoryDetail>(ENGAGEMENT_STAGE_HISTORY, { id: engagementId });
    const e = detail.engagement;
    if (!e) return { status: "not_found" as const, message: "The engagement could not be loaded from the CRM." };

    const changes = input.allFields
      ? e.stageChanges
      : e.stageChanges.filter((c) => c.field === "engagementStage");

    return {
      status: "ok" as const,
      engagement: { id: e.id, name: e.name, currentStage: e.engagementStage },
      investor: { id: e.investor.id, name: e.investor.name },
      deal: { id: e.transaction.id, name: e.transaction.name },
      history: changes.map((c) => ({
        field: c.field,
        from: c.fromValue ?? null,
        to: c.toValue,
        changedAt: c.changedAt,
        source: c.createdSource,
        changedBy: c.changedBy?.name ?? null,
      })),
      historyCount: changes.length,
      link: `${crm.baseUrl}/engagement/${e.id}`,
    };
  }
}
