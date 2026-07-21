import { LuaTool } from "lua-cli";
import { z } from "zod";
import { CrmClient, crmClientFromEnv } from "../../lib/crm-client";
import { SUBMIT_INVESTOR_UPDATE } from "../../lib/queries";
import { SECTORS, GEOGRAPHIES, INSTRUMENTS, INVESTMENT_STAGES, INVESTOR_STATUSES } from "../../lib/enums";
import { CHANNEL_UNVERIFIED, verifiedSender } from "../../lib/request-sender";

// Contact fields live on the Person record — the CRM only accepts them when a
// personId accompanies the submission, otherwise it rejects the whole update
// ("Field \"firstName\" is not allowed in an investor proposed change").
const PERSON_FIELDS = ["firstName", "lastName", "email", "phone", "jobTitle"] as const;

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
    // Contact fields (REQUIRE contactPersonId — they belong to the contact person, not the investor):
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
    "Record changes an investor communicated to their criteria, status, or contact details. Creates a PENDING change the Noblestride team must confirm — nothing is written to the record immediately. Contact-detail changes (name, email, phone, job title) apply to the contact person and REQUIRE contactPersonId. Tell the investor their update was noted and will be reflected after review.";

  inputSchema = z
    .object({
      investorId: z.string().describe("Investor id from identify_investor"),
      contactPersonId: z
        .string()
        .optional()
        .describe("Person id of the contact — REQUIRED when changing contact details (name, email, phone, job title)"),
      changes: changesSchema,
      summary: z.string().min(5).describe("One-sentence summary of what changed, in plain English"),
    })
    .superRefine((val, ctx) => {
      const personFields = PERSON_FIELDS.filter((f) => val.changes[f] !== undefined);
      if (personFields.length > 0 && !val.contactPersonId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contactPersonId"],
          message: `Contact fields (${personFields.join(", ")}) belong to the contact person — provide contactPersonId (identify_investor / the CRM match returns it) or the CRM will reject the update.`,
        });
      }
    });

  constructor(private deps?: { crm?: CrmClient; transportFrom?: () => string | undefined }) {}

  async execute(input: z.infer<typeof this.inputSchema>) {
    // SECURITY: writes are queued for review, but the target record and the audit
    // trail must still be bound to a transport-verified sender — off-email any
    // visitor could file updates against an arbitrary investor's review queue.
    const resolveFrom = this.deps?.transportFrom ?? verifiedSender;
    const transportFrom = resolveFrom();
    if (!transportFrom) return { ok: false as const, ...CHANNEL_UNVERIFIED };

    const entries = Object.entries(input.changes).filter(([, v]) => v !== undefined);
    if (entries.length === 0) throw new Error("Provide at least one changed field");
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ submitInvestorUpdate: { ok: boolean } }>(SUBMIT_INVESTOR_UPDATE, {
      input: {
        investorId: input.investorId,
        personId: input.contactPersonId ?? null,
        proposedFieldsJson: JSON.stringify(Object.fromEntries(entries)),
        summary: input.summary,
        sourceEmail: transportFrom,
      },
    });
    return { ok: data.submitInvestorUpdate.ok === true, note: "Queued for Noblestride team review — not yet applied." };
  }
}
