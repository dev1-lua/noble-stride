import { LuaTool } from "lua-cli";
import { z } from "zod";
import { CrmClient, crmClientFromEnv } from "../../lib/crm-client";
import { EXPRESS_DEAL_INTEREST } from "../../lib/queries";
import { CHANNEL_UNVERIFIED, verifiedSender } from "../../lib/request-sender";

/**
 * Called when a MATCHED investor's reply indicates genuine interest in the
 * opportunity we pitched (they want the teaser / more detail / next steps).
 * The CRM surfaces the interest to the deal owner and returns a SECURE PORTAL
 * LINK. Deal specifics are never shared over email — the agent replies with the
 * link so the investor logs in and views the teaser through the normal, access-
 * gated portal flow. `matched:false` means there is no open outreach loop for
 * this investor, in which case the agent should fall back to pointing them to
 * their Noblestride contact rather than inventing a link.
 */
export default class ExpressDealInterestTool implements LuaTool {
  name = "express_deal_interest";
  description =
    "Use ONLY when a matched investor's reply shows genuine INTEREST in the opportunity you pitched — e.g. they say yes/keen, ask for the teaser, or want more detail/next steps. Do NOT use this for a plain deal-awareness question like 'what deal am I looking at' or 'which opportunity is this' — that's get_engaged_deals (read-only, records nothing). This tool RECORDS their interest for the Noblestride deal team (be honest that it notifies the team) and returns a secure, one-time portal login link for that deal. Requires investorId from identify_investor; pass dealHint with any codename/subject they mentioned. NEVER share deal specifics over email — reply with the returned portalUrl so they log in and view the teaser in the portal, and include that link EXACTLY as returned (do not rewrite, shorten, or decode it). Refer to the deal only by the returned dealName (a codename). If it returns matched=false, do NOT send a link; explain there is no active opportunity on file for them right now and point them to their Noblestride contact instead.";

  inputSchema = z.object({
    investorId: z.string().describe("Investor id from identify_investor"),
    dealHint: z
      .string()
      .optional()
      .describe("Optional: the deal codename or subject the investor referenced, to disambiguate when they have more than one open opportunity."),
  });

  constructor(private deps?: { crm?: CrmClient; transportFrom?: () => string | undefined }) {}

  async execute(input: z.infer<typeof this.inputSchema>) {
    // SECURITY: this tool mints a per-deal portal login link and records an
    // "interested" signal against a deal owner's queue. Like every other investor
    // tool it must bind to a transport-verified sender — off-email (e.g. webchat)
    // a visitor could otherwise pass an arbitrary investorId to spoof interest or
    // fish out a link. Fail closed to the channel_unverified refusal the skill's
    // step 3b already handles; never fall back to a model-supplied identity.
    const resolveFrom = this.deps?.transportFrom ?? verifiedSender;
    if (!resolveFrom()) {
      return { dealName: null, portalUrl: null, ...CHANNEL_UNVERIFIED };
    }

    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{
      expressDealInterestForAgent: { matched: boolean; dealName: string | null; portalUrl: string | null };
    }>(EXPRESS_DEAL_INTEREST, { investorId: input.investorId, dealHint: input.dealHint ?? null });
    return data.expressDealInterestForAgent;
  }
}
