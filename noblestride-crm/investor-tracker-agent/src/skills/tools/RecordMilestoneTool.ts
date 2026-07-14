import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { ENGAGEMENT_TRACKER_DETAIL, RECORD_MILESTONE, UNRECORD_MILESTONE, LOG_ACTIVITY } from "../../lib/queries";
import { checkExcludedGuard } from "../../lib/guards";

const inputSchema = z.object({
  engagementId: z.string().min(1).describe("From a prior get_engagement_status or scan call"),
  action: z
    .enum(["record", "unrecord"])
    .default("record")
    .describe("record marks the milestone complete (upsert, safe to re-run); unrecord removes a mistaken entry"),
  key: z
    .enum([
      "TeaserReview",
      "NdaExecuted",
      "ExpressionOfInterest",
      "DataRoomAccess",
      "PreliminaryDD",
      "ICPaperPrepared",
      "FirstICApproval",
      "NonBindingTermSheet",
      "TermSheetExecuted",
      "OnsiteDD",
      "SecondICApproval",
      "BindingOffer",
      "DefinitiveAgreements",
      "CompetitionApproval",
      "SuccessFeePaid",
    ])
    .describe("Which of the 15 investor-process milestones"),
  completedAt: z.string().optional().describe("ISO datetime the milestone was completed (defaults to now)"),
  notes: z.string().optional(),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

export class RecordMilestoneTool implements LuaTool {
  name = "record_milestone";
  description =
    "Record (or unrecord) one of the 15 investor-process milestones on an engagement — teaser review through NDA, IC approvals, term sheet, agreements, competition approval, success fee. REQUIRES prior user confirmation. Recording DataRoomAccess documents that a human already granted access — this agent never grants access itself.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();

    const detail = await crm.query<{
      engagement: { id: string; investor: { id: string; name: string; engagementClassification?: string | null } } | null;
    }>(ENGAGEMENT_TRACKER_DETAIL, { id: input.engagementId });
    const engagement = detail.engagement;
    if (!engagement) return { status: "not_found" as const, message: "The engagement could not be loaded from the CRM." };

    // Milestones only ever advance an engagement — wind-down never applies here.
    const guard = checkExcludedGuard(engagement.investor);
    if (!guard.allowed) return { status: "refused" as const, message: guard.message };

    try {
      if (input.action === "unrecord") {
        await crm.query<{ unrecordMilestone: boolean }>(UNRECORD_MILESTONE, {
          engagementId: input.engagementId,
          key: input.key,
        });
      } else {
        await crm.query<{ recordMilestone: { id: string } }>(RECORD_MILESTONE, {
          input: {
            engagementId: input.engagementId,
            key: input.key,
            completedAt: input.completedAt,
            notes: input.notes,
          },
        });
      }
    } catch (err) {
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        return { status: "blocked" as const, message: err.message };
      }
      throw err;
    }

    let auditLogged = true;
    try {
      await crm.query(LOG_ACTIVITY, {
        input: {
          type: "Note",
          subject: "Investor Tracker Agent milestone",
          body: `${input.action === "unrecord" ? "Unrecorded" : "Recorded"} milestone ${input.key}${input.notes ? ` — ${input.notes}` : ""}`,
          engagementId: input.engagementId,
        },
      });
    } catch {
      auditLogged = false;
    }

    return {
      status: "ok" as const,
      action: input.action,
      key: input.key,
      auditLogged,
      link: `${crm.baseUrl}/engagement/${input.engagementId}`,
    };
  }
}
