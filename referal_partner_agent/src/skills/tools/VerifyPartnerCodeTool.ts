import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { VERIFY_PARTNER_ACCESS_CODE } from "../../lib/queries";

const inputSchema = z.object({
  partnerRef: z
    .string()
    .min(1)
    .describe("How the partner identifies themselves — their name or the email on their partner record"),
  code: z.string().min(1).describe("The access code / PIN the partner was given by Noblestride"),
});

export class VerifyPartnerCodeTool implements LuaTool {
  name = "verify_partner_code";
  description =
    "Verify a referral partner's identity with the access code Noblestride gave them. On success returns a short-lived token used by get_partner_selfview / update_partner_selfinfo. On 'failed' the code didn't match (or the partner/lockout) — say it didn't work and offer to try again; never reveal whether the partner or code exists.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ verifyPartnerAccessCode: { status: string; token?: string | null } }>(
      VERIFY_PARTNER_ACCESS_CODE,
      { partnerRef: input.partnerRef, code: input.code },
    );
    if (data.verifyPartnerAccessCode.status === "ok" && data.verifyPartnerAccessCode.token) {
      return { status: "ok" as const, token: data.verifyPartnerAccessCode.token };
    }
    return { status: "failed" as const };
  }
}
