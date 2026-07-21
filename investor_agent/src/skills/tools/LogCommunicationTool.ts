import { LuaTool } from "lua-cli";
import { z } from "zod";
import { CrmClient, crmClientFromEnv } from "../../lib/crm-client";
import { LOG_COMMUNICATION } from "../../lib/queries";
import { INTERACTION_TYPES } from "../../lib/enums";
import { CHANNEL_UNVERIFIED, verifiedSender } from "../../lib/request-sender";

export default class LogCommunicationTool implements LuaTool {
  name = "log_communication";
  description =
    "Log an investor communication (email received/sent, feedback, meeting note) against the investor's CRM record so the team sees it and response times are tracked.";

  inputSchema = z.object({
    investorId: z.string().describe("Investor id from identify_investor"),
    direction: z.enum(["Inbound", "Outbound"]),
    interactionType: z.enum(INTERACTION_TYPES).describe("Email for plain correspondence, Feedback when the investor gives deal/process feedback"),
    subject: z.string().optional().describe("The email subject, if any"),
    summary: z.string().min(5).describe("2-3 sentence factual summary of the message"),
  });

  constructor(private deps?: { crm?: CrmClient; transportFrom?: () => string | undefined }) {}

  async execute(input: z.infer<typeof this.inputSchema>) {
    // SECURITY: only a transport-verified email sender may write to an investor's
    // activity log — off-email the investorId is a model-supplied guess any
    // visitor can steer (2026-07-21 prod QA).
    const resolveFrom = this.deps?.transportFrom ?? verifiedSender;
    if (!resolveFrom()) return { ok: false as const, ...CHANNEL_UNVERIFIED };

    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ logInvestorCommunication: { ok: boolean } }>(LOG_COMMUNICATION, {
      input: {
        investorId: input.investorId,
        direction: input.direction,
        interactionType: input.interactionType,
        subject: input.subject ?? null,
        summary: input.summary,
      },
    });
    return { ok: data.logInvestorCommunication.ok === true };
  }
}
