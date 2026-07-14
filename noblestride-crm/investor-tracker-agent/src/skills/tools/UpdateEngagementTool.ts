import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { ENGAGEMENT_TRACKER_DETAIL, UPDATE_ENGAGEMENT, LOG_ACTIVITY } from "../../lib/queries";
import { checkExcludedGuard } from "../../lib/guards";

const setSchema = z
  .object({
    engagementStage: z
      .enum(["Shared", "TeaserSent", "NDASigned", "IMShared", "VDRAccess", "Meeting", "InfoRequest", "DueDiligence", "TermSheet", "Offer", "Invested", "Declined"])
      .optional()
      .describe("New engagement stage. Advancing past NDA-gated stages requires an NDA on record — the CRM enforces this."),
    interestLevel: z.enum(["Low", "Medium", "High"]).optional(),
    ndaType: z.enum(["Open", "Closed"]).optional().describe("Records which NDA covers this engagement"),
    termSheetIssued: z.boolean().optional().describe("Whether a term sheet has been issued — status only, never the terms themselves"),
    termSheetDate: z.string().optional().describe("ISO date the term sheet was issued/received"),
    totalAmount: z.number().nonnegative().optional().describe("Total committed amount"),
    amountDisbursed: z.number().nonnegative().optional().describe("Amount disbursed to date"),
    disbursementStatus: z.enum(["Disbursed", "Ongoing", "FellOff", "Dropped"]).optional(),
    dateReceived: z.string().optional().describe("ISO date funds were received"),
    probability: z.number().int().min(0).max(100).optional(),
    feedback: z.string().optional().describe("Investor feedback to record"),
    notes: z.string().optional(),
  })
  .refine((s) => Object.values(s).some((v) => v !== undefined), { message: "set must change at least one field" });

const inputSchema = z.object({
  engagementId: z.string().min(1).describe("From a prior get_engagement_status or scan call"),
  set: setSchema.describe("Only the fields to change"),
  reason: z.string().min(1).describe("One line explaining the change — written to the CRM audit trail"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

export class UpdateEngagementTool implements LuaTool {
  name = "update_engagement";
  description =
    "Update one investor-deal engagement: stage, interest, NDA type, term-sheet status/date, amounts, disbursement, probability, feedback. REQUIRES prior user confirmation of the exact change. Records facts only — never drafts, issues, or accepts commercial terms, and cannot grant VDR or data-room access. Every update is logged to the CRM activity trail.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    // Re-validate inside execute: direct invocations (e.g. `lua test`) bypass
    // the platform's schema check, and the confirmed gate must hold everywhere.
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "rejected" as const, message: `Invalid input: ${parsed.error.issues[0]?.message ?? "schema mismatch"}. Writes require confirmed: true after explicit user approval.` };
    }
    const crm = this.deps?.crm ?? crmClientFromEnv();

    const detail = await crm.query<{
      engagement: {
        id: string;
        transactionId: string;
        investorId: string;
        investor: { id: string; name: string; engagementClassification?: string | null };
      } | null;
    }>(ENGAGEMENT_TRACKER_DETAIL, { id: input.engagementId });
    const engagement = detail.engagement;
    if (!engagement) return { status: "not_found" as const, message: "The engagement could not be loaded from the CRM." };

    const guard = checkExcludedGuard(engagement.investor, input.set);
    if (!guard.allowed) return { status: "refused" as const, message: guard.message };

    const set = Object.fromEntries(Object.entries(input.set).filter(([, v]) => v !== undefined));
    let updated: Record<string, unknown>;
    try {
      const result = await crm.query<{ updateEngagement: Record<string, unknown> }>(UPDATE_ENGAGEMENT, {
        id: input.engagementId,
        input: {
          // EngagementInput requires both ids even on update — echo the existing ones.
          transactionId: engagement.transactionId,
          investorId: engagement.investorId,
          ...set,
        },
      });
      updated = result.updateEngagement;
    } catch (err) {
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        // Server-side rule (e.g. the NDA guard on stage advances) — relay, don't fail opaquely.
        return { status: "blocked" as const, message: err.message };
      }
      throw err;
    }

    let auditLogged = true;
    try {
      const diff = Object.entries(set)
        .map(([k, v]) => `${k} → ${String(v)}`)
        .join(", ");
      await crm.query(LOG_ACTIVITY, {
        input: {
          type: "Note",
          subject: "Investor Tracker Agent update",
          body: `${input.reason}\nChanged: ${diff}`,
          engagementId: input.engagementId,
        },
      });
    } catch {
      auditLogged = false; // the update itself already committed
    }

    return {
      status: "ok" as const,
      updated,
      auditLogged,
      link: `${crm.baseUrl}/engagement/${input.engagementId}`,
    };
  }
}
