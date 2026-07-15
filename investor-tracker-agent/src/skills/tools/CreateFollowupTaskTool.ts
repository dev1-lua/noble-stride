import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { ENGAGEMENT_TRACKER_DETAIL, CREATE_TASK } from "../../lib/queries";
import { resolveEngagement } from "../../lib/engagement-resolve";

export const TASK_ATTRIBUTION = "Created by Investor Tracker Agent";

/** Skip weekends when defaulting a due date. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}

const inputSchema = z.object({
  title: z.string().min(1).describe("Short imperative task title, e.g. 'Follow up with Vantage on the term sheet'"),
  body: z.string().optional().describe("Context for whoever picks the task up"),
  dueAt: z.string().optional().describe("ISO datetime the task is due — defaults to 3 business days from now"),
  engagementId: z
    .string()
    .optional()
    .describe("Preferred — links the task to both the deal and the investor automatically"),
  investor: z.string().optional().describe("Investor name/id, used with deal when engagementId is unknown"),
  deal: z.string().optional().describe("Deal name/id, used with investor when engagementId is unknown"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact task in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

export class CreateFollowupTaskTool implements LuaTool {
  name = "create_followup_task";
  description =
    "Create a follow-up Task for the deal lead, linked to the relevant deal and investor. REQUIRES prior user confirmation. The deal lead acts on it — this agent never contacts anyone itself.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient; now?: () => Date }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    // Re-validate inside execute: direct invocations (e.g. `lua test`) bypass
    // the platform's schema check, and the confirmed gate must hold everywhere.
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "rejected" as const, message: `Invalid input: ${parsed.error.issues[0]?.message ?? "schema mismatch"}. Writes require confirmed: true after explicit user approval.` };
    }
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const now = this.deps?.now ? this.deps.now() : new Date();

    let transactionId: string | undefined;
    let investorId: string | undefined;
    let engagementLink: string | undefined;

    if (input.engagementId) {
      const detail = await crm.query<{
        engagement: { id: string; transactionId: string; investorId: string } | null;
      }>(ENGAGEMENT_TRACKER_DETAIL, { id: input.engagementId });
      if (!detail.engagement) {
        return { status: "not_found" as const, message: "The engagement could not be loaded from the CRM." };
      }
      transactionId = detail.engagement.transactionId;
      investorId = detail.engagement.investorId;
      engagementLink = `${crm.baseUrl}/engagement/${detail.engagement.id}`;
    } else if (input.investor && input.deal) {
      const resolution = await resolveEngagement(crm, input.investor, input.deal);
      if (resolution.kind === "ambiguous_investor" || resolution.kind === "ambiguous_deal") {
        return {
          status: resolution.kind,
          message: "Multiple records match — ask the user to pick one, then call again with the chosen id.",
          candidates: resolution.candidates,
        };
      }
      if (resolution.kind === "investor_not_found" || resolution.kind === "deal_not_found") {
        return { status: resolution.kind, message: "No matching record was found in the CRM." };
      }
      // no_engagement still allows a task — link deal + investor directly.
      if (resolution.kind === "ok") {
        engagementLink = `${crm.baseUrl}/engagement/${resolution.engagementId}`;
      }
      transactionId = resolution.transaction.id;
      investorId = resolution.investor.id;
    }
    // With neither identifier the task is created unlinked — still valid.

    const dueAt = input.dueAt ?? addBusinessDays(now, 3).toISOString();
    const bodyParts = [input.body, engagementLink, `${TASK_ATTRIBUTION}.`].filter(Boolean);

    const result = await crm.query<{ createTask: { id: string; title: string; status: string; dueAt: string | null } }>(
      CREATE_TASK,
      {
        input: {
          title: input.title,
          body: bodyParts.join("\n"),
          status: "NotStarted",
          source: "Other",
          dueAt,
          transactionId,
          investorId,
        },
      },
    );

    return { status: "ok" as const, task: result.createTask, link: engagementLink ?? null };
  }
}
