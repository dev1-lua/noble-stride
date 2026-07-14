import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { CHECK_COMPANY } from "../../lib/queries";

const inputSchema = z.object({
  companyName: z.string().min(1).describe("The company's name exactly as the visitor stated it"),
  contactEmail: z
    .string()
    .email()
    .optional()
    .describe("The visitor's email, if shared — used only to verify a claimed existing relationship"),
});

export class CheckCompanyTool implements LuaTool {
  name = "check_company";
  description =
    "Silently check whether a company already has a relationship with NobleStride. Returns ONLY a status enum (new / known_verified / known_unverified) — never any record data. Call this before choosing between submit_intake (new) and log_client_message (known).";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ checkCompany: { status: string } }>(CHECK_COMPANY, {
      name: input.companyName,
      contactEmail: input.contactEmail ?? null,
    });
    return { status: data.checkCompany.status };
  }
}
