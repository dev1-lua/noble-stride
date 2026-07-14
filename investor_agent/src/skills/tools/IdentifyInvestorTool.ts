import { LuaTool } from "lua-cli";
import { z } from "zod";
import { CrmClient, crmClientFromEnv } from "../../lib/crm-client";
import { INVESTOR_BY_EMAIL } from "../../lib/queries";

export default class IdentifyInvestorTool implements LuaTool {
  name = "identify_investor";
  description =
    "Look up whether the sender's email belongs to a known investor contact. INTERNAL routing only — never repeat the raw result (matched or not) to the sender.";

  inputSchema = z.object({
    senderEmail: z.string().email().describe("The From address of the inbound email"),
  });

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof this.inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{
      investorByEmail: { matched: boolean; investorId?: string; investorName?: string; contactName?: string };
    }>(INVESTOR_BY_EMAIL, { email: input.senderEmail });
    return data.investorByEmail;
  }
}
