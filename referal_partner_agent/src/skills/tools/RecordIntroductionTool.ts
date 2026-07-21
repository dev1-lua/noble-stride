import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { GLOBAL_SEARCH, CREATE_PARTNER, UPDATE_PARTNER, PARTNER_BY_ID, CREATE_TASK, LOG_ACTIVITY } from "../../lib/queries";
import { resolveRecord, type SearchResult } from "../../lib/resolve";
import { looksLikeRecordId } from "../../lib/record-lookup";
import { addBusinessDays } from "../../lib/format";

export const TASK_ATTRIBUTION = "Created by Referral Partner Agent";

const partnerFieldsSchema = z.object({
  partnerType: z.enum(["LawFirm", "Auditor", "Advisor", "Bank", "InvestmentBank", "Consulting", "Other"]).optional(),
  advisorType: z.enum(["Lawyer", "Investor", "Consultant", "TransactionAdvisor", "AdvisoryFirm", "Other"]).optional(),
  organization: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  profile: z.string().optional().describe("Short description of who the partner is"),
});

const inputSchema = z.object({
  partner: z.string().min(1).describe("The introducing partner — name as the user said it, or an exact id"),
  partnerAction: z
    .enum(["create_new", "use_existing"])
    .describe(
      "Whether this introduction creates a NEW partner record or attaches to an EXISTING one. The confirmation you asked the user must have stated which.",
    ),
  introduced: z.string().min(1).describe("Who/what was introduced — the company or opportunity, as the user described it"),
  details: z.string().optional().describe("Any context the user gave: sector, size, timing, how the introduction happened"),
  partnerFields: partnerFieldsSchema.optional().describe("Partner contact/profile details to store on the partner record"),
  existingDealId: z.string().optional().describe("Only when the introduction concerns a deal already in the CRM — its exact id from a previous lookup"),
  existingDealType: z.enum(["mandate", "transaction"]).optional().describe("Required when existingDealId is set"),
  createAnyway: z
    .boolean()
    .optional()
    .describe("Only after the user has seen the possible duplicates and still wants a new partner record"),
  reason: z.string().min(1).describe("One line explaining the entry — written to the CRM audit trail"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact introduction — including whether the partner record is new or existing — in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

/**
 * Records an introduction: upserts the Partner and files a review Task for
 * staff. DELIBERATELY cannot create mandates or transactions — if staff decide
 * the introduction becomes a mandate, that's the separate, explicitly-invoked
 * create_referred_mandate tool. This tool never imports CREATE_MANDATE.
 */
export class RecordIntroductionTool implements LuaTool {
  name = "record_introduction";
  description =
    "Record a partner introduction: create or update the Partner record and file a review task for staff (due in 3 business days). Does NOT create a deal — deals are only created by staff after review, or via create_referred_mandate when explicitly instructed. REQUIRES prior user confirmation stating whether the partner record is new or existing.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient; now?: () => Date }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    // Re-validate inside execute: direct invocations (e.g. `lua test`) bypass
    // the platform's schema check, and the confirmed gate must hold everywhere.
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "rejected" as const, message: `Invalid input: ${parsed.error.issues[0]?.message ?? "schema mismatch"}. Writes require confirmed: true after explicit user approval.` };
    }
    if (input.existingDealId && !input.existingDealType) {
      return { status: "rejected" as const, message: "existingDealType is required when existingDealId is set." };
    }
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const now = this.deps?.now ? this.deps.now() : new Date();

    // ── Resolve or create the partner ──────────────────────────────────────
    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, { query: input.partner, limit: 10 });
    const resolution = resolveRecord(search.globalSearch, "partner", input.partner);

    let partnerId: string;
    let partnerName: string;
    let partnerCreated: boolean;

    if (input.partnerAction === "use_existing") {
      let existing: { id: string; title: string } | null = null;
      if (resolution.kind === "match") {
        existing = { id: resolution.result.id, title: resolution.result.title };
      } else if (resolution.kind === "none" && looksLikeRecordId(input.partner)) {
        try {
          const byId = await crm.query<{ partner: { id: string; name: string } | null }>(PARTNER_BY_ID, { id: input.partner.trim() });
          if (byId.partner) existing = { id: byId.partner.id, title: byId.partner.name };
        } catch {
          // fall through to the search verdict
        }
      }
      if (!existing) {
        if (resolution.kind === "ambiguous") {
          return {
            status: "ambiguous" as const,
            message: "Multiple partners match — ask the user to pick one, then call again with the chosen id.",
            candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
          };
        }
        return { status: "partner_not_found" as const, message: `No existing partner matching "${input.partner}" — if this is a new partner, confirm create-new with the user and call again with partnerAction: "create_new".` };
      }
      partnerId = existing.id;
      partnerName = existing.title;
      partnerCreated = false;

      const fields = Object.fromEntries(Object.entries(input.partnerFields ?? {}).filter(([, v]) => v !== undefined));
      if (Object.keys(fields).length > 0) {
        try {
          // PartnerInput requires name even on update — echo the existing one.
          await crm.query(UPDATE_PARTNER, { id: partnerId, input: { name: partnerName, ...fields } });
        } catch (err) {
          if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
            return { status: "blocked" as const, message: err.message };
          }
          throw err;
        }
      }
    } else {
      // create_new: guard against duplicates — globalSearch is contains-based,
      // so any partner hit for this name deserves a second look.
      const nameHits = search.globalSearch.filter((r) => r.type === "Partner");
      if (nameHits.length > 0 && !input.createAnyway) {
        return {
          status: "possible_duplicate" as const,
          message:
            "Partners with similar names already exist. Show them to the user; if they want one of these, call again with partnerAction: \"use_existing\" and the chosen id — otherwise call again with createAnyway: true.",
          candidates: nameHits.slice(0, 5).map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
        };
      }
      const fields = Object.fromEntries(Object.entries(input.partnerFields ?? {}).filter(([, v]) => v !== undefined));
      let created: { id: string; name: string };
      try {
        const result = await crm.query<{ createPartner: { id: string; name: string } }>(CREATE_PARTNER, {
          input: { name: input.partner.trim(), ...fields },
        });
        created = result.createPartner;
      } catch (err) {
        if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
          return { status: "blocked" as const, message: err.message };
        }
        throw err;
      }
      partnerId = created.id;
      partnerName = created.name;
      partnerCreated = true;
    }

    // ── File the review task (never a deal) — always linked to the Partner
    // (spec §3.8 link rule), plus the deal when the intro concerns one. ──────
    const dealFk =
      input.existingDealId && input.existingDealType
        ? { [input.existingDealType === "mandate" ? "mandateId" : "transactionId"]: input.existingDealId }
        : {};
    let task: { id: string; title: string; dueAt?: string | null };
    try {
      const result = await crm.query<{ createTask: { id: string; title: string; dueAt?: string | null } }>(CREATE_TASK, {
        input: {
          title: `Review referral introduction: ${input.introduced} (introduced by ${partnerName})`,
          body: [input.details, input.reason, `${TASK_ATTRIBUTION} (record_introduction).`].filter(Boolean).join("\n"),
          status: "NotStarted",
          source: "Other",
          dueAt: addBusinessDays(now, 3).toISOString(),
          partnerId,
          ...dealFk,
        },
      });
      task = result.createTask;
    } catch (err) {
      if (err instanceof CrmError && err.message !== CRM_DOWN_MESSAGE) {
        return {
          status: "partial" as const,
          message: `The partner record was ${partnerCreated ? "created" : "updated"}, but the review task failed: ${err.message}`,
          partner: { id: partnerId, name: partnerName, created: partnerCreated },
          link: `${crm.baseUrl}/partners/${partnerId}`,
        };
      }
      throw err;
    }

    // ── Best-effort audit note. LogActivityInput has no partnerId, so the
    // note can only attach to a linked deal; without one, auditLogged is
    // honestly false (the review task still records the introduction). ──────
    let auditLogged = false;
    if (input.existingDealId && input.existingDealType) {
      try {
        await crm.query(LOG_ACTIVITY, {
          input: {
            type: "Note",
            subject: "Referral Partner Agent: introduction recorded",
            body: `${input.reason}\nIntroduced: ${input.introduced} (by ${partnerName})`,
            [input.existingDealType === "mandate" ? "mandateId" : "transactionId"]: input.existingDealId,
          },
        });
        auditLogged = true;
      } catch {
        // the writes themselves already committed
      }
    }

    return {
      status: "ok" as const,
      partner: { id: partnerId, name: partnerName, created: partnerCreated },
      reviewTask: { id: task.id, title: task.title, dueAt: task.dueAt ?? null },
      auditLogged,
      link: `${crm.baseUrl}/partners/${partnerId}`,
    };
  }
}
