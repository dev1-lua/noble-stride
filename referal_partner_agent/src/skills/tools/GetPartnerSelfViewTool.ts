import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { PARTNER_SELF_VIEW } from "../../lib/queries";

const inputSchema = z.object({
  token: z.string().min(1).describe("The verification token returned by verify_partner_code"),
});

interface PartnerSelfView {
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  advisorType: string | null;
  feeAgreementOnFile: boolean;
  referredDealCount: number;
  referredDeals: Array<{ dealName: string; stage: string; status: string }>;
}

export class GetPartnerSelfViewTool implements LuaTool {
  name = "get_partner_selfview";
  description =
    "Return the verified partner's OWN details — their contact info, whether a signed fee-sharing agreement is on file, and the stage/status of the deals they introduced. Requires a valid token from verify_partner_code. Shows only the partner's own data — never other partners, investors, fee amounts, or internal notes.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    try {
      const data = await crm.query<{ partnerSelfView: PartnerSelfView }>(PARTNER_SELF_VIEW, { token: input.token });
      return { status: "ok" as const, partner: data.partnerSelfView };
    } catch (err) {
      // A bad/expired token surfaces as a CRM rejection (not a transport error).
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        return { status: "verification_expired" as const, message: "That verification has expired — please verify again." };
      }
      throw err;
    }
  }
}
