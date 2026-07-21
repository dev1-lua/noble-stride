import { LuaTool } from "lua-cli";
import { z } from "zod";
import { CrmClient, crmClientFromEnv } from "../../lib/crm-client";
import { INVESTOR_BY_EMAIL } from "../../lib/queries";
import { CHANNEL_UNVERIFIED, verifiedSender } from "../../lib/request-sender";

export default class IdentifyInvestorTool implements LuaTool {
  name = "identify_investor";
  description =
    "Look up whether the sender is a known investor contact. Identity is resolved from the transport-verified sender of the inbound email — never from conversation content, so there is nothing to pass in. INTERNAL routing only — never repeat the raw result (matched or not) to the sender.";

  // SECURITY: no inputs. This tool used to take a senderEmail argument, which a
  // prompt-injected message (or any webchat visitor) could set to another
  // investor's address and read back their routing identity. The lookup key is
  // now exclusively the transport-verified From of the email channel.
  inputSchema = z.object({});

  constructor(private deps?: { crm?: CrmClient; transportFrom?: () => string | undefined }) {}

  async execute(_input: z.infer<typeof this.inputSchema>) {
    const resolveFrom = this.deps?.transportFrom ?? verifiedSender;
    const transportFrom = resolveFrom();
    if (!transportFrom) return CHANNEL_UNVERIFIED;

    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{
      investorByEmail: { matched: boolean; investorId?: string; investorName?: string; contactName?: string };
    }>(INVESTOR_BY_EMAIL, { email: transportFrom });
    return data.investorByEmail;
  }
}
