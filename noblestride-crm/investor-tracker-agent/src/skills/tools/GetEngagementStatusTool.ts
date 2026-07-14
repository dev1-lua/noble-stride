import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { ENGAGEMENT_TRACKER_DETAIL } from "../../lib/queries";
import { resolveEngagement } from "../../lib/engagement-resolve";
import { thresholdsFromEnv, idleDays, type EngagementStage, type StaleThresholds } from "../../lib/staleness";

export interface TrackerReadDeps {
  crm: CrmClient;
  thresholds?: StaleThresholds;
  now?: () => Date;
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

interface EngagementDetail {
  engagement: {
    id: string;
    name: string;
    status: string;
    engagementStage: EngagementStage;
    interestLevel?: string | null;
    ndaType?: string | null;
    ndaSignedAt?: string | null;
    termSheetIssued: boolean;
    termSheetDate?: string | null;
    totalAmount?: number | null;
    amountDisbursed?: number | null;
    amountPending?: number | null;
    disbursementStatus?: string | null;
    dateReceived?: string | null;
    probability?: number | null;
    feedback?: string | null;
    notes?: string | null;
    lastContact?: string | null;
    updatedAt: string;
    transactionId: string;
    investorId: string;
    transaction: {
      id: string;
      name: string;
      stage: string;
      dealStatus: string;
      client: { id: string; name: string } | null;
      ddTracks: Array<{ track: string; status: string; notes?: string | null; startedAt?: string | null; completedAt?: string | null }>;
    };
    investor: { id: string; name: string; investorType?: string | null; engagementClassification?: string | null; ndaStatus?: string | null };
    milestones: Array<{ key: string; completedAt: string; notes?: string | null }>;
    activities: Array<{ type: string; subject: string; body?: string | null; occurredAt: string; channel?: string | null; direction?: string | null }>;
  } | null;
}

export class GetEngagementStatusTool implements LuaTool {
  name = "get_engagement_status";
  description =
    "Full tracking picture of ONE investor's engagement on ONE deal: stage, NDA, term sheet, amounts and disbursement, the milestone checklist, the deal's due-diligence tracks, recent activity, a staleness verdict, and a deep link. Identify the engagement either by engagementId (from a previous call) or by investor + deal names.";
  inputSchema = inputSchema;

  constructor(private deps?: TrackerReadDeps) {}

  private getDeps(): Required<Pick<TrackerReadDeps, "crm">> & TrackerReadDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const deps = this.getDeps();
    const { crm } = deps;

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
            message:
              `${resolution.investor.name} has no engagement on ${resolution.transaction.name}. ` +
              "Starting a new investor-deal engagement is outside this agent's scope (that's investor outreach).",
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

    const detail = await crm.query<EngagementDetail>(ENGAGEMENT_TRACKER_DETAIL, { id: engagementId });
    const e = detail.engagement;
    if (!e) return { status: "not_found" as const, message: "The engagement could not be loaded from the CRM." };

    const thresholds = deps.thresholds ?? thresholdsFromEnv();
    const now = deps.now ? deps.now() : new Date();
    const idle = idleDays(now, e);
    const threshold = e.engagementStage === "Declined" ? null : thresholds[e.engagementStage] ?? null;

    return {
      status: "ok" as const,
      engagement: {
        id: e.id,
        name: e.name,
        stage: e.engagementStage,
        coarseStatus: e.status,
        interestLevel: e.interestLevel ?? null,
        nda: { type: e.ndaType ?? null, signedAt: e.ndaSignedAt ?? null, investorNdaStatus: e.investor.ndaStatus ?? null },
        termSheet: { issued: e.termSheetIssued, date: e.termSheetDate ?? null },
        amounts: {
          total: e.totalAmount ?? null,
          disbursed: e.amountDisbursed ?? null,
          pending: e.amountPending ?? null,
          disbursementStatus: e.disbursementStatus ?? null,
          dateReceived: e.dateReceived ?? null,
        },
        probability: e.probability ?? null,
        feedback: e.feedback ?? null,
        notes: e.notes ?? null,
        investor: {
          id: e.investor.id,
          name: e.investor.name,
          type: e.investor.investorType ?? null,
          classification: e.investor.engagementClassification ?? null,
        },
        deal: {
          id: e.transaction.id,
          name: e.transaction.name,
          stage: e.transaction.stage,
          dealStatus: e.transaction.dealStatus,
          client: e.transaction.client?.name ?? null,
        },
        milestones: e.milestones,
        ddTracks: e.transaction.ddTracks,
        recentActivities: e.activities.slice(0, 10),
        staleness: {
          idleDays: Number.isFinite(idle) ? idle : null,
          thresholdDays: threshold,
          isStale: threshold !== null && idle >= threshold,
        },
      },
      link: `${crm.baseUrl}/engagement/${e.id}`,
    };
  }
}
