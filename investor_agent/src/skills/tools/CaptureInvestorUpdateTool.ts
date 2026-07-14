import { LuaTool } from "lua-cli";
import { z } from "zod";
import { CrmClient, crmClientFromEnv } from "../../lib/crm-client";
import { SUBMIT_INVESTOR_UPDATE } from "../../lib/queries";
import { SECTORS, GEOGRAPHIES, INSTRUMENTS, INVESTMENT_STAGES, INVESTOR_STATUSES } from "../../lib/enums";

const changesSchema = z
  .object({
    sectorFocus: z.array(z.enum(SECTORS)).optional().describe("Full replacement list of sectors the investor targets"),
    geographicFocus: z.array(z.enum(GEOGRAPHIES)).optional(),
    instruments: z.array(z.enum(INSTRUMENTS)).optional(),
    investmentStages: z.array(z.enum(INVESTMENT_STAGES)).optional(),
    ticketMin: z.number().nonnegative().optional().describe("Minimum ticket in USD"),
    ticketMax: z.number().nonnegative().optional().describe("Maximum ticket in USD"),
    targetIrr: z.number().optional(),
    status: z.enum(INVESTOR_STATUSES).optional().describe("Deployment status"),
    countryRestrictions: z.string().optional(),
    esgFocus: z.string().optional(),
    investmentMandate: z.string().optional(),
    feedback: z.string().optional(),
    // Contact fields (only when contactPersonId is provided):
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    jobTitle: z.string().optional(),
  })
  .describe("Only the fields the investor explicitly changed");

export default class CaptureInvestorUpdateTool implements LuaTool {
  name = "capture_investor_update";
  description =
    "Record changes an investor communicated to their criteria, status, or contact details. Creates a PENDING change the NobleStride team must confirm — nothing is written to the record immediately. Tell the investor their update was noted and will be reflected after review.";

  inputSchema = z.object({
    investorId: z.string().describe("Investor id from identify_investor"),
    contactPersonId: z.string().optional().describe("Person id, only when changing contact details"),
    changes: changesSchema,
    summary: z.string().min(5).describe("One-sentence summary of what changed, in plain English"),
    senderEmail: z.string().email().describe("The sender's email address, for the audit trail"),
  });

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof this.inputSchema>) {
    const entries = Object.entries(input.changes).filter(([, v]) => v !== undefined);
    if (entries.length === 0) throw new Error("Provide at least one changed field");
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ submitInvestorUpdate: { ok: boolean } }>(SUBMIT_INVESTOR_UPDATE, {
      input: {
        investorId: input.investorId,
        personId: input.contactPersonId ?? null,
        proposedFieldsJson: JSON.stringify(Object.fromEntries(entries)),
        summary: input.summary,
        sourceEmail: input.senderEmail,
      },
    });
    return { ok: data.submitInvestorUpdate.ok === true, note: "Queued for NobleStride team review — not yet applied." };
  }
}
