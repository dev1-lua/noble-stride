import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { VERIFY_STATUS_OTP } from "../../lib/queries";

const inputSchema = z.object({
  companyName: z.string().min(1).describe("The company the visitor claims to represent"),
  contactEmail: z.string().email().describe("The visitor's own email — the same one the code was requested for"),
  code: z.string().min(1).describe("The 6-digit code the visitor received by email"),
});

export class VerifyStatusCodeTool implements LuaTool {
  name = "verify_status_code";
  description =
    "Check the 6-digit code the visitor received. Returns a short-lived token on success. On 'failed' tell them the code didn't work and offer ONE fresh code.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ verifyClientStatusOtp: { status: string; token?: string | null } }>(
      VERIFY_STATUS_OTP,
      { companyName: input.companyName, contactEmail: input.contactEmail, code: input.code },
    );
    if (data.verifyClientStatusOtp.status === "ok" && data.verifyClientStatusOtp.token) {
      return { status: "ok" as const, token: data.verifyClientStatusOtp.token };
    }
    return { status: "failed" as const };
  }
}
