import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient, CrmError, CRM_DOWN_MESSAGE } from "../../lib/crm-client";
import { TRANSACTION_DD_TRACKS, UPSERT_DD_TRACK, LOG_ACTIVITY } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";

const inputSchema = z.object({
  deal: z.string().min(1).describe("The transaction/deal whose due diligence to update — name or exact id"),
  track: z.enum(["Financial", "Tax", "Commercial", "ESG", "Legal"]).describe("Which DD workstream"),
  status: z.enum(["NotStarted", "InProgress", "Complete", "Flagged", "NotApplicable"]),
  notes: z.string().optional(),
  startedAt: z.string().optional().describe("ISO datetime the workstream started"),
  completedAt: z.string().optional().describe("ISO datetime the workstream completed"),
  confirmed: z
    .literal(true)
    .describe(
      "Only pass true after the user has explicitly confirmed this exact change in this conversation. If you have not asked yet, ask first — do not call this tool.",
    ),
});

interface DdTrack {
  track: string;
  status: string;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export class UpdateDDStatusTool implements LuaTool {
  name = "update_dd_status";
  description =
    "Update the status of one due-diligence workstream (Financial, Tax, Commercial, ESG, Legal) on a deal, then return all five tracks. REQUIRES prior user confirmation. DD tracks are internal-only records.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    // Re-validate inside execute: direct invocations (e.g. `lua test`) bypass
    // the platform's schema check, and the confirmed gate must hold everywhere.
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "rejected" as const, message: `Invalid input: ${parsed.error.issues[0]?.message ?? "schema mismatch"}. Writes require confirmed: true after explicit user approval.` };
    }
    const crm = this.deps?.crm ?? crmClientFromEnv();

    const resolution = await resolveByNameOrId(crm, "transaction", input.deal);
    if (resolution.kind === "none") {
      return { status: "not_found" as const, message: `No deal matching "${input.deal}" was found in the CRM.` };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: "Multiple deals match — ask the user to pick one, then call again with the chosen id.",
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }
    const transactionId = resolution.result.id;

    try {
      await crm.query<{ upsertDueDiligenceTrack: DdTrack }>(UPSERT_DD_TRACK, {
        input: {
          transactionId,
          track: input.track,
          status: input.status,
          notes: input.notes,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
        },
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
          subject: "Investor Tracker Agent DD update",
          body: `${input.track} due diligence → ${input.status}${input.notes ? ` — ${input.notes}` : ""}`,
          transactionId,
        },
      });
    } catch {
      auditLogged = false;
    }

    // Return the full DD picture after the change.
    const detail = await crm.query<{ transaction: { ddTracks: DdTrack[] } | null }>(TRANSACTION_DD_TRACKS, {
      id: transactionId,
    });

    return {
      status: "ok" as const,
      deal: resolution.result.title,
      ddTracks: detail.transaction?.ddTracks ?? [],
      auditLogged,
      link: `${crm.baseUrl}${resolution.result.href}`,
    };
  }
}
