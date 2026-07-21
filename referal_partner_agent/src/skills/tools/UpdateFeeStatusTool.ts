import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { staffRefusal, type StaffCheck } from "../../lib/staff-mode";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { TRANSACTION_REFERRAL_STATUS, UPDATE_TRANSACTION, LOG_ACTIVITY } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";
import { checkFeeGuard, type PartnerAgreementFields } from "../../lib/guards";

const setSchema = z
  .object({
    partnerFeeStatus: z.enum(["NotDue", "Due", "Invoiced", "Paid"]).optional(),
    partnerFeeAmount: z.number().nonnegative().optional(),
  })
  .refine((s) => Object.values(s).some((v) => v !== undefined), { message: "set must change at least one field" });

const inputSchema = z.object({
  transaction: z.string().min(1).describe("The transaction the fee is on — name or exact id (partner fees live on transactions)"),
  set: setSchema.describe("Only the fields to change"),
  reason: z.string().min(1).describe("One line explaining the change — written to the CRM audit trail"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact fee change in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

interface OriginatorPartner extends PartnerAgreementFields {
  id: string;
}

export class UpdateFeeStatusTool implements LuaTool {
  name = "update_fee_status";
  description =
    "Record the status (NotDue/Due/Invoiced/Paid) and amount of a referring partner's fee on a transaction. REFUSED unless the partner has a recorded, signed fee-sharing agreement — record the agreement first via update_partner. Records facts only: never computes, negotiates, or pays fees. REQUIRES prior user confirmation of the exact change.";
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

    const resolution = await resolveByNameOrId(crm, "transaction", input.transaction);
    if (resolution.kind === "none") {
      return { status: "not_found" as const, message: `No transaction matching "${input.transaction}" was found in the CRM.` };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: "Multiple transactions match — ask the user to pick one, then call again with the chosen id.",
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const detail = await crm.query<{
      transaction: {
        id: string;
        name: string;
        clientId: string;
        partnerFeeStatus?: string | null;
        partnerFeeAmount?: number | null;
        referredBy: OriginatorPartner | null;
        mandate: { referredBy: OriginatorPartner | null } | null;
      } | null;
    }>(TRANSACTION_REFERRAL_STATUS, { id: resolution.result.id });
    const txn = detail.transaction;
    if (!txn) return { status: "not_found" as const, message: "The transaction could not be loaded from the CRM." };

    // The fee belongs to the originator: direct referral first, else the
    // parent mandate's referrer.
    const partner = txn.referredBy ?? txn.mandate?.referredBy ?? null;
    const guard = checkFeeGuard(partner, input.set);
    if (!guard.allowed) return { status: "refused" as const, message: guard.message };

    const set = Object.fromEntries(Object.entries(input.set).filter(([, v]) => v !== undefined));
    let updated: Record<string, unknown>;
    try {
      const result = await crm.query<{ updateTransaction: Record<string, unknown> }>(UPDATE_TRANSACTION, {
        id: txn.id,
        // TransactionInput requires name/clientId even on update — echo them.
        input: { name: txn.name, clientId: txn.clientId, ...set },
      });
      updated = result.updateTransaction;
    } catch (err) {
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        return { status: "blocked" as const, message: err.message };
      }
      throw err;
    }

    let auditLogged = true;
    try {
      const diff = Object.entries(set)
        .map(([k, v]) => `${k} → ${String(v)}`)
        .join(", ");
      await crm.query(LOG_ACTIVITY, {
        input: {
          type: "Note",
          subject: "Referral Partner Agent: fee status updated",
          body: `${input.reason}\nPartner: ${partner?.name ?? "(unknown)"}\nChanged: ${diff}`,
          transactionId: txn.id,
        },
      });
    } catch {
      auditLogged = false; // the update itself already committed
    }

    return {
      status: "ok" as const,
      updated,
      partner: partner ? { id: partner.id, name: partner.name } : null,
      previous: { partnerFeeStatus: txn.partnerFeeStatus ?? null, partnerFeeAmount: txn.partnerFeeAmount ?? null },
      ...(guard.warning ? { warning: guard.warning } : {}),
      auditLogged,
      link: `${crm.baseUrl}/transactions/${txn.id}`,
    };
  }
}
