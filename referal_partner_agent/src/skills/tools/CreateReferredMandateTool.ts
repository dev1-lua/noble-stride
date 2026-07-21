import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { staffRefusal, type StaffCheck } from "../../lib/staff-mode";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { CREATE_MANDATE, LOG_ACTIVITY } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";

const SECTORS = [
  "Agribusiness", "FinancialServices", "FMCG", "Manufacturing", "RenewableEnergy",
  "Technology", "Healthcare", "Banking", "RealEstate", "Education", "Infrastructure",
  "Aviation", "Construction", "Hospitality", "Leasing", "MediaEntertainment", "Services",
  "TransportLogistics", "WaterSanitation", "Energy", "OilAndGas", "Mining",
  "Gambling", "Alcohol", "Tobacco",
] as const;

const inputSchema = z.object({
  client: z.string().min(1).describe("The EXISTING client the mandate is for — name or exact id. This tool never creates clients."),
  partner: z.string().min(1).describe("The introducing partner — name or exact id"),
  mandateName: z.string().min(1).describe("Name for the new mandate, e.g. 'Acme Foods — growth capital raise'"),
  dealSize: z.number().positive().optional(),
  currency: z.string().optional().describe("ISO currency code, e.g. USD or KES"),
  sector: z.array(z.enum(SECTORS)).optional(),
  notes: z.string().optional(),
  reason: z.string().min(1).describe("One line explaining the creation — written to the CRM audit trail"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has EXPLICITLY instructed you to create this mandate (e.g. 'create the mandate') and confirmed the exact details in this conversation. An introduction alone is NOT an instruction to create a mandate.",
    ),
});

export class CreateReferredMandateTool implements LuaTool {
  name = "create_referred_mandate";
  description =
    "Create a new mandate attributed to a referring partner. ONLY on explicit staff instruction to create the mandate — a recorded introduction is NOT enough; the default path for introductions is record_introduction (partner + review task). Requires an existing client. REQUIRES prior user confirmation of the exact details.";
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

    const clientRes = await resolveByNameOrId(crm, "client", input.client);
    if (clientRes.kind === "none") {
      return {
        status: "client_not_found" as const,
        message: `No client matching "${input.client}" exists in the CRM. Referred mandates need an existing client record — onboarding a new client is a human workflow, not something this agent can do.`,
      };
    }
    if (clientRes.kind === "ambiguous") {
      return {
        status: "ambiguous_client" as const,
        message: "Multiple clients match — ask the user to pick one, then call again with the chosen id.",
        candidates: clientRes.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const partnerRes = await resolveByNameOrId(crm, "partner", input.partner);
    if (partnerRes.kind === "none") {
      return {
        status: "partner_not_found" as const,
        message: `No partner matching "${input.partner}" was found. Record the introduction first (record_introduction) so the partner exists, then create the mandate.`,
      };
    }
    if (partnerRes.kind === "ambiguous") {
      return {
        status: "ambiguous_partner" as const,
        message: "Multiple partners match — ask the user to pick one, then call again with the chosen id.",
        candidates: partnerRes.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    let mandate: { id: string; name: string; stage: string };
    try {
      const result = await crm.query<{ createMandate: { id: string; name: string; stage: string } }>(CREATE_MANDATE, {
        input: {
          name: input.mandateName,
          clientId: clientRes.result.id,
          referredById: partnerRes.result.id,
          source: "Referral",
          ...(input.dealSize !== undefined ? { dealSize: input.dealSize } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.sector !== undefined ? { sector: input.sector } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
      mandate = result.createMandate;
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
          subject: "Referral Partner Agent: referred mandate created",
          body: `${input.reason}\nMandate: ${mandate.name}, referred by ${partnerRes.result.title}`,
          mandateId: mandate.id,
        },
      });
    } catch {
      auditLogged = false; // the mandate itself already committed
    }

    return {
      status: "ok" as const,
      mandate: { id: mandate.id, name: mandate.name, stage: mandate.stage },
      referredBy: { id: partnerRes.result.id, name: partnerRes.result.title },
      client: { id: clientRes.result.id, name: clientRes.result.title },
      auditLogged,
      link: `${crm.baseUrl}/mandates/${mandate.id}`,
    };
  }
}
