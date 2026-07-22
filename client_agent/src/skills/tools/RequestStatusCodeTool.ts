import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { REQUEST_STATUS_OTP } from "../../lib/queries";

const inputSchema = z.object({
  companyName: z.string().min(1).describe("The company the visitor claims to represent"),
  contactEmail: z.string().email().describe("The visitor's own email — used server-side to match a registered contact"),
});

export class RequestStatusCodeTool implements LuaTool {
  name = "request_status_code";
  description =
    "Silently trigger a verification code email IF the company+email match our records. ALWAYS returns ok — never reveals whether they matched. Tell the visitor: 'if those details match our records, a code is on its way.'";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    await crm.query<{ requestClientStatusOtp: { ok: boolean } }>(REQUEST_STATUS_OTP, {
      companyName: input.companyName,
      contactEmail: input.contactEmail,
    });
    // QA MODE (env-gated): when CLIENT_STATUS_TEST_OTP is set, no emailed code is
    // needed — a matched company+email is verified straight away. We signal that to
    // the skill with codeRequired:false so it skips the "give me the code" step and
    // calls verify_status_code immediately. Unset in production it is inert. Enable
    // only for a controlled QA window (see the CRM-side security note).
    if (process.env.CLIENT_STATUS_TEST_OTP) return { status: "ok" as const, codeRequired: false as const };
    return { status: "ok" as const };
  }
}
