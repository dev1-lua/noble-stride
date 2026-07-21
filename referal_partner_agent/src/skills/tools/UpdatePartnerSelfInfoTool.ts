import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { SUBMIT_PARTNER_SELF_UPDATE } from "../../lib/queries";

const setSchema = z
  .object({
    email: z.string().email().optional().describe("The partner's own contact email"),
    phone: z.string().min(1).optional().describe("The partner's own contact phone"),
    organization: z.string().min(1).optional().describe("The partner's own organization / firm name"),
  })
  .refine((s) => Object.values(s).some((v) => v !== undefined), { message: "set must change at least one field" });

const inputSchema = z.object({
  token: z.string().min(1).describe("The verification token returned by verify_partner_code"),
  set: setSchema.describe("Only the OWN contact fields the partner wants to change (email, phone, organization)"),
  summary: z.string().min(1).describe("One line describing what the partner is changing — shown to the staff reviewer"),
});

export class UpdatePartnerSelfInfoTool implements LuaTool {
  name = "update_partner_selfinfo";
  description =
    "Submit an update to the verified partner's OWN contact details (email, phone, organization). Requires a valid token from verify_partner_code. This does NOT change the record directly — it queues the change for a Noblestride staff member to review and apply. A partner can never change fee-sharing/agreement status, their name, or anything about other records.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const set = Object.fromEntries(Object.entries(input.set).filter(([, v]) => v !== undefined));
    try {
      await crm.query<{ submitPartnerSelfUpdate: { ok: boolean } }>(SUBMIT_PARTNER_SELF_UPDATE, {
        input: { token: input.token, proposedFieldsJson: JSON.stringify(set), summary: input.summary },
      });
      return {
        status: "ok" as const,
        message: "Thanks — your update has been sent to the Noblestride team to review and apply.",
      };
    } catch (err) {
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        return { status: "verification_expired" as const, message: "That verification has expired — please verify again." };
      }
      throw err;
    }
  }
}
