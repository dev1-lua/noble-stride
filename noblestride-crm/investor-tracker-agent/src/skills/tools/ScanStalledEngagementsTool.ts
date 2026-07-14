import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { resolveByNameOrId } from "../../lib/record-lookup";
import { scanEngagements, type ScanFilter } from "../../lib/tracker-runner";
import { thresholdsFromEnv, type StaleThresholds } from "../../lib/staleness";

const inputSchema = z.object({
  deal: z.string().optional().describe("Limit the scan to one transaction/deal (name or exact id)"),
  investor: z.string().optional().describe("Limit the scan to one investor (name or exact id)"),
});

export class ScanStalledEngagementsTool implements LuaTool {
  name = "scan_stalled_engagements";
  description =
    "Scan investor-deal engagements on live deals for stalled or overdue items: idle beyond the per-stage threshold, disbursements still outstanding, or issued term sheets missing their date. Read-only — offer create_followup_task for any flag the deal lead wants actioned.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient; thresholds?: StaleThresholds; now?: () => Date }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const thresholds = this.deps?.thresholds ?? thresholdsFromEnv();

    const filter: ScanFilter = {};
    for (const [field, recordType, key] of [
      ["deal", "transaction", "transactionId"],
      ["investor", "investor", "investorId"],
    ] as const) {
      const query = input[field];
      if (!query) continue;
      const resolution = await resolveByNameOrId(crm, recordType, query);
      if (resolution.kind === "none") {
        return { status: "not_found" as const, message: `No ${recordType} matching "${query}" was found.` };
      }
      if (resolution.kind === "ambiguous") {
        return {
          status: "ambiguous" as const,
          message: `Multiple ${recordType}s match "${query}" — ask the user to pick one, then call again with the chosen id.`,
          candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
        };
      }
      filter[key] = resolution.result.id;
    }

    const flags = await scanEngagements({ crm, thresholds, now: this.deps?.now }, filter);

    return {
      status: "ok" as const,
      flagged: flags.length,
      flags: flags.map((f) => ({
        investor: f.investor.name,
        deal: f.transaction.name,
        stage: f.stage,
        reason: f.reason,
        detail: f.detail,
        idleDays: Number.isFinite(f.idleDays) ? f.idleDays : null,
        engagementId: f.engagementId,
        link: f.link,
      })),
    };
  }
}
