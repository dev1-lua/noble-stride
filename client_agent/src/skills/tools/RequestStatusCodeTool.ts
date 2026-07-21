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
    // TEST-ONLY (env-gated): when CLIENT_STATUS_TEST_OTP is set, surface the fixed
    // test code "000000" so the data-out flow can be exercised without an inbox.
    // The CRM only accepts it for a company+email that actually matches. Unset in
    // production it is inert. "000000" is guessable, so enable only for controlled QA.
    if (process.env.CLIENT_STATUS_TEST_OTP) return { status: "ok" as const, testCode: "000000" };
    return { status: "ok" as const };
  }
}
