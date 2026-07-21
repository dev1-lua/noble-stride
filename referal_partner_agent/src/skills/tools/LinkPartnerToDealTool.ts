import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { staffRefusal, type StaffCheck } from "../../lib/staff-mode";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { MANDATE_REFERRAL_STATUS, TRANSACTION_REFERRAL_STATUS, UPDATE_MANDATE, UPDATE_TRANSACTION, LOG_ACTIVITY } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";

const inputSchema = z.object({
  partner: z.string().min(1).describe("The referring partner — name or exact id"),
  deal: z.string().min(1).describe("The deal to attribute — name or exact id"),
  dealType: z.enum(["mandate", "transaction"]).describe("Which pipeline the deal is in"),
  overrideExisting: z
    .boolean()
    .optional()
    .describe("Only after the user has seen the current originator and explicitly chosen to replace them"),
  reason: z.string().min(1).describe("One line explaining the link — written to the CRM audit trail"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact partner-to-deal link in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

export class LinkPartnerToDealTool implements LuaTool {
  name = "link_partner_to_deal";
  description =
    "Attribute an existing deal (mandate or transaction) to a referring partner by setting its referredBy link. Reports a conflict if a different partner is already recorded as originator — replacing them requires the user to explicitly opt in. REQUIRES prior user confirmation of the exact link.";
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

    const partnerRes = await resolveByNameOrId(crm, "partner", input.partner);
    if (partnerRes.kind === "none") {
      return { status: "partner_not_found" as const, message: `No partner matching "${input.partner}" was found in the CRM.` };
    }
    if (partnerRes.kind === "ambiguous") {
      return {
        status: "ambiguous_partner" as const,
        message: "Multiple partners match — ask the user to pick one, then call again with the chosen id.",
        candidates: partnerRes.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const dealRes = await resolveByNameOrId(crm, input.dealType, input.deal);
    if (dealRes.kind === "none") {
      return { status: "deal_not_found" as const, message: `No ${input.dealType} matching "${input.deal}" was found in the CRM.` };
    }
    if (dealRes.kind === "ambiguous") {
      return {
        status: "ambiguous_deal" as const,
        message: "Multiple deals match — ask the user to pick one, then call again with the chosen id.",
        candidates: dealRes.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const partnerId = partnerRes.result.id;
    const partnerName = partnerRes.result.title;
    const dealId = dealRes.result.id;
    const linkPath = input.dealType === "mandate" ? "/mandates" : "/transactions";

    // Fetch current state: conflict check + echo fields (inputs require
    // name/clientId even on update).
    let dealName: string;
    let clientId: string;
    let currentOriginator: { id: string; name: string } | null;
    if (input.dealType === "mandate") {
      const detail = await crm.query<{ mandate: { id: string; name: string; clientId: string; referredBy: { id: string; name: string } | null } | null }>(
        MANDATE_REFERRAL_STATUS,
        { id: dealId },
      );
      if (!detail.mandate) return { status: "deal_not_found" as const, message: "The mandate could not be loaded from the CRM." };
      dealName = detail.mandate.name;
      clientId = detail.mandate.clientId;
      currentOriginator = detail.mandate.referredBy;
    } else {
      const detail = await crm.query<{ transaction: { id: string; name: string; clientId: string; referredBy: { id: string; name: string } | null } | null }>(
        TRANSACTION_REFERRAL_STATUS,
        { id: dealId },
      );
      if (!detail.transaction) return { status: "deal_not_found" as const, message: "The transaction could not be loaded from the CRM." };
      dealName = detail.transaction.name;
      clientId = detail.transaction.clientId;
      currentOriginator = detail.transaction.referredBy;
    }

    if (currentOriginator && currentOriginator.id === partnerId) {
      return {
        status: "already_linked" as const,
        message: `${dealName} is already attributed to ${partnerName} — nothing to change.`,
        link: `${crm.baseUrl}${linkPath}/${dealId}`,
      };
    }
    if (currentOriginator && !input.overrideExisting) {
      return {
        status: "conflict" as const,
        message:
          `${dealName} is already attributed to ${currentOriginator.name}. ` +
          `Replacing the originator changes referral credit — show this to the user, and only call again with overrideExisting: true if they explicitly choose to replace.`,
        currentOriginator: { name: currentOriginator.name },
        link: `${crm.baseUrl}${linkPath}/${dealId}`,
      };
    }

    const mutation = input.dealType === "mandate" ? UPDATE_MANDATE : UPDATE_TRANSACTION;
    try {
      await crm.query(mutation, {
        id: dealId,
        input: { name: dealName, clientId, referredById: partnerId },
      });
    } catch (err) {
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        return { status: "blocked" as const, message: err.message };
      }
      throw err;
    }

    let auditLogged = true;
    try {
      await crm.query(LOG_ACTIVITY, {
        input: {
          type: "Note",
          subject: "Referral Partner Agent: partner linked to deal",
          body: `${input.reason}\n${dealName} attributed to ${partnerName}${currentOriginator ? ` (replacing ${currentOriginator.name})` : ""}`,
          [input.dealType === "mandate" ? "mandateId" : "transactionId"]: dealId,
        },
      });
    } catch {
      auditLogged = false; // the link itself already committed
    }

    return {
      status: "ok" as const,
      deal: { id: dealId, name: dealName, type: input.dealType },
      originator: { id: partnerId, name: partnerName },
      replaced: currentOriginator ? { name: currentOriginator.name } : null,
      auditLogged,
      link: `${crm.baseUrl}${linkPath}/${dealId}`,
    };
  }
}
