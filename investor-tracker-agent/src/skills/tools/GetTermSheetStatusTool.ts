import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { ENGAGEMENT_TRACKER_DETAIL } from "../../lib/queries";
import { resolveEngagement } from "../../lib/engagement-resolve";

export interface TermSheetDeps {
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
});

interface TrackerDetail {
  engagement: {
    id: string;
    name: string;
    engagementStage: string;
    termSheetIssued: boolean;
    termSheetDate?: string | null;
    transaction: { id: string; name: string };
    investor: { id: string; name: string };
    milestones: Array<{ key: string; completedAt: string; notes?: string | null }>;
  } | null;
}

/** Synthesized term-sheet state — there is no single term-sheet enum on the model. */
export type TermSheetState = "none" | "non_binding_issued" | "executed";

export class GetTermSheetStatusTool implements LuaTool {
  name = "get_term_sheet_status";
  description =
    "Where one investor's engagement stands on the term sheet for one deal: whether a non-binding term sheet has been issued and whether it has been executed, with the relevant dates and a deep link. Identify by engagementId (from a previous call) or by investor + deal names.";
  inputSchema = inputSchema;

  constructor(private deps?: TermSheetDeps) {}

  private getDeps(): TermSheetDeps {
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

    const detail = await crm.query<TrackerDetail>(ENGAGEMENT_TRACKER_DETAIL, { id: engagementId });
    const e = detail.engagement;
    if (!e) return { status: "not_found" as const, message: "The engagement could not be loaded from the CRM." };

    const nonBinding = e.milestones.find((m) => m.key === "NonBindingTermSheet") ?? null;
    const executed = e.milestones.find((m) => m.key === "TermSheetExecuted") ?? null;

    const state: TermSheetState = executed
      ? "executed"
      : e.termSheetIssued || nonBinding
        ? "non_binding_issued"
        : "none";

    return {
      status: "ok" as const,
      engagement: { id: e.id, name: e.name, stage: e.engagementStage },
      investor: { id: e.investor.id, name: e.investor.name },
      deal: { id: e.transaction.id, name: e.transaction.name },
      termSheet: {
        state,
        issued: e.termSheetIssued,
        // termSheetDate is the engagement's recorded issue date; milestones give the executed checkpoint.
        issuedDate: e.termSheetDate ?? nonBinding?.completedAt ?? null,
        executedAt: executed?.completedAt ?? null,
      },
      link: `${crm.baseUrl}/engagement/${e.id}`,
    };
  }
}
