import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { ISSUE_PARTNER_ACCESS_CODE } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";

const inputSchema = z.object({
  partner: z.string().min(1).describe("The partner to issue a code for — name as the user said it, or an exact id from a previous result"),
});

// STAFF-ONLY (wrapped with withStaffGuard in the skill). Generates/rotates a
// partner's static access code and returns it ONCE so staff can pass it to the
// partner out-of-band (email/WhatsApp/call). Issuing a new code invalidates any
// previous one.
export class IssuePartnerAccessCodeTool implements LuaTool {
  name = "issue_partner_access_code";
  description =
    "Staff only. Generate (or rotate) the access code a referral partner uses to verify themselves and view/update their own details. Returns the code ONCE — share it with the partner directly; it is not stored in readable form. Issuing a new code replaces any previous one.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();

    const resolution = await resolveByNameOrId(crm, "partner", input.partner);
    if (resolution.kind === "none") {
      return { status: "not_found" as const, message: `No partner matching "${input.partner}" was found in the CRM.` };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: "Multiple partners match — ask the user to pick one, then call again with the chosen id.",
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const data = await crm.query<{ issuePartnerAccessCode: { code: string } }>(ISSUE_PARTNER_ACCESS_CODE, {
      partnerId: resolution.result.id,
    });
    return {
      status: "ok" as const,
      partner: { id: resolution.result.id, name: resolution.result.title },
      code: data.issuePartnerAccessCode.code,
      note: "Share this code with the partner directly (it won't be shown again). They can use it to verify and manage their own details.",
    };
  }
}
