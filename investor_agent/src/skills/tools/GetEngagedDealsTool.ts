import { LuaTool } from "lua-cli";
import { z } from "zod";
import { CrmClient, crmClientFromEnv } from "../../lib/crm-client";
import { INVESTOR_ENGAGED_DEALS } from "../../lib/queries";
import { CHANNEL_UNVERIFIED, verifiedSender } from "../../lib/request-sender";

export interface EngagedDealForAgent {
  engagementId: string;
  codename: string;
  status: string;
  stagePhrase: string;
}

const normalize = (e: string | undefined) => e?.trim().toLowerCase() ?? "";

/**
 * READ-ONLY deal-awareness lookup (B2). Answers "do you know what deal I'm
 * looking at" without recording anything or minting a portal login link —
 * unlike express_deal_interest (a mutation reserved for explicit interest),
 * this is a plain query over the investor's own engaged deals. Codename,
 * status, and stagePhrase only: never a real client/deal name or figures.
 *
 * SECURITY: identity is bound to the transport-verified email sender, same
 * posture as get_investor_selfview — a prompt-injected inbound email can
 * never redirect another investor's engaged-deal list to the attacker, and
 * off-email channels (no verified identity) refuse outright rather than
 * trusting a model-supplied address.
 */
export default class GetEngagedDealsTool implements LuaTool {
  name = "get_engaged_deals";
  description =
    "Return the sender's OWN engaged deals (codename, status, stage phrase) to answer deal-awareness questions like 'what deal am I looking at', 'my deal', or 'which opportunity is this'. Read-only — it records nothing and mints no portal link. Identity is the sender's own verified email; never returns any other investor's deals. Do NOT use this to record interest — use express_deal_interest when the investor explicitly says they're interested.";

  inputSchema = z.object({
    senderEmail: z.string().email().describe("The From address of the inbound email"),
  });

  constructor(private deps?: { crm: CrmClient; transportFrom?: () => string | undefined }) {}

  async execute(input: z.infer<typeof this.inputSchema>) {
    const resolveFrom = this.deps?.transportFrom ?? verifiedSender;
    const transportFrom = resolveFrom();

    // Same identity binding as GetInvestorSelfViewTool: the transport-verified From is
    // the only trustworthy sender on this channel. A model-supplied senderEmail that
    // disagrees with it is a cross-investor read attempt, and no verified transport
    // sender at all (e.g. webchat/dev) refuses outright.
    if (!transportFrom) {
      return { deals: [] as EngagedDealForAgent[], ...CHANNEL_UNVERIFIED };
    }
    if (normalize(input.senderEmail) && normalize(input.senderEmail) !== normalize(transportFrom)) {
      return { matched: false as const, deals: [] as EngagedDealForAgent[] };
    }

    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ investorEngagedDeals: EngagedDealForAgent[] }>(INVESTOR_ENGAGED_DEALS, {
      investorEmail: transportFrom,
    });
    return { matched: true as const, deals: data.investorEngagedDeals ?? [] };
  }
}
