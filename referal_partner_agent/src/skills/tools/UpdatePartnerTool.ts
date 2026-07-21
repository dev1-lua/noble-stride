import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { staffRefusal, type StaffCheck } from "../../lib/staff-mode";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { PARTNER_REFERRAL_DETAIL, UPDATE_PARTNER, LOG_ACTIVITY } from "../../lib/queries";

const setSchema = z
  .object({
    name: z.string().min(1).optional(),
    partnerType: z.enum(["LawFirm", "Auditor", "Advisor", "Bank", "InvestmentBank", "Consulting", "Other"]).optional(),
    advisorType: z.enum(["Lawyer", "Investor", "Consultant", "TransactionAdvisor", "AdvisoryFirm", "Other"]).optional(),
    status: z.enum(["Active", "Preferred", "Inactive"]).optional(),
    location: z.string().optional(),
    organization: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    profile: z.string().optional(),
    feeSharingAgreement: z.boolean().optional().describe("Whether a fee-sharing agreement exists with this partner"),
    feeSharingTerms: z.string().optional().describe("The agreed fee-sharing terms, e.g. '2% of closed transaction value'"),
    partnerAgreementStatus: z.enum(["None", "Sent", "Signed"]).optional(),
    internalOnly: z.boolean().optional().describe("Partner identity must never reach investors — this marks the record internal-only"),
    feedbackNotes: z.string().optional().describe("Internal feedback about working with this partner — never shared externally"),
    amount: z.number().nonnegative().optional(),
    currency: z.string().optional(),
  })
  .refine((s) => Object.values(s).some((v) => v !== undefined), { message: "set must change at least one field" });

const inputSchema = z.object({
  partnerId: z.string().min(1).describe("Exact partner id from a prior get_partner_profile or candidates list"),
  set: setSchema.describe("Only the fields to change"),
  reason: z.string().min(1).describe("One line explaining the change — written to the CRM audit trail"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

export class UpdatePartnerTool implements LuaTool {
  name = "update_partner";
  description =
    "Update one partner record: contact/profile details, status, fee-sharing agreement and terms, agreement status, internal-only flag, feedback notes. This is also how a signed fee-sharing agreement gets recorded. REQUIRES prior user confirmation of the exact change.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient; isStaff?: StaffCheck }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const refusal = await staffRefusal(this.deps?.isStaff);
    if (refusal) return refusal;
    // Re-validate inside execute: direct invocations (e.g. `lua test`) bypass
    // the platform's schema check, and the confirmed gate must hold everywhere.
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "rejected" as const, message: `Invalid input: ${parsed.error.issues[0]?.message ?? "schema mismatch"}. Writes require confirmed: true after explicit user approval.` };
    }
    const crm = this.deps?.crm ?? crmClientFromEnv();

    const detail = await crm.query<{
      partner: {
        id: string;
        name: string;
        feeSharingAgreement: boolean;
        feeSharingTerms?: string | null;
        partnerAgreementStatus: string;
        referredMandates: Array<{ id: string }>;
        referredTransactions: Array<{ id: string }>;
      } | null;
    }>(PARTNER_REFERRAL_DETAIL, { id: input.partnerId });
    const partner = detail.partner;
    if (!partner) return { status: "not_found" as const, message: "The partner could not be loaded from the CRM." };

    const set = Object.fromEntries(Object.entries(input.set).filter(([, v]) => v !== undefined));
    let updated: Record<string, unknown>;
    try {
      const result = await crm.query<{ updatePartner: Record<string, unknown> }>(UPDATE_PARTNER, {
        id: input.partnerId,
        // PartnerInput requires name even on update — echo the existing one.
        input: { name: partner.name, ...set },
      });
      updated = result.updatePartner;
    } catch (err) {
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        return { status: "blocked" as const, message: err.message };
      }
      throw err;
    }

    // Warn when the merged state claims an agreement but records no terms.
    const merged = {
      feeSharingAgreement: (set.feeSharingAgreement as boolean | undefined) ?? partner.feeSharingAgreement,
      feeSharingTerms: (set.feeSharingTerms as string | undefined) ?? partner.feeSharingTerms,
    };
    const warning =
      merged.feeSharingAgreement && (!merged.feeSharingTerms || String(merged.feeSharingTerms).trim() === "")
        ? "The partner now has feeSharingAgreement: true but no feeSharingTerms recorded — suggest adding the agreed terms."
        : undefined;

    // ── Best-effort audit note. LogActivityInput has no partnerId, so the
    // note attaches to a referred deal when one exists; otherwise auditLogged
    // is honestly false. ─────────────────────────────────────────────────────
    let auditLogged = false;
    const anchorMandateId = partner.referredMandates[0]?.id;
    const anchorTransactionId = partner.referredTransactions[0]?.id;
    if (anchorMandateId || anchorTransactionId) {
      try {
        const diff = Object.entries(set)
          .map(([k, v]) => `${k} → ${String(v)}`)
          .join(", ");
        await crm.query(LOG_ACTIVITY, {
          input: {
            type: "Note",
            subject: "Referral Partner Agent: partner updated",
            body: `${input.reason}\nPartner: ${partner.name}\nChanged: ${diff}`,
            ...(anchorMandateId ? { mandateId: anchorMandateId } : { transactionId: anchorTransactionId }),
          },
        });
        auditLogged = true;
      } catch {
        // the update itself already committed
      }
    }

    return {
      status: "ok" as const,
      updated,
      ...(warning ? { warning } : {}),
      auditLogged,
      link: `${crm.baseUrl}/partners/${input.partnerId}`,
    };
  }
}
