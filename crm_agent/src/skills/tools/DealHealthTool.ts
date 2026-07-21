import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { GLOBAL_SEARCH, DETAIL_QUERIES, DOCUMENTS_QUERY, DOCUMENT_ARG } from "../../lib/queries";
import { resolveRecord, type RecordType, type SearchResult } from "../../lib/resolve";
import { assessDealHealth } from "../../lib/analysis";
import { buildDealHealthPrompt } from "../../lib/format";

export interface AnalysisDeps { crm: CrmClient; generate: (prompt: string) => Promise<string> }

const inputSchema = z.object({
  recordType: z.enum(["client", "investor", "mandate", "transaction", "engagement", "partner"]),
  query: z.string().min(1).describe("The record's name as the user said it, or an exact id from a prior candidates list"),
  focus: z.string().optional().describe("Optional angle, e.g. 'risks' or 'NDA status'"),
});

export class DealHealthTool implements LuaTool {
  name = "deal_health";
  description = "Run a deal-health / completeness review on one CRM record (client, investor, mandate, transaction, engagement, or partner): flags stalls, missing NDA, no recent activity, gaps, and returns an insightful review.";
  inputSchema = inputSchema;

  constructor(private deps?: AnalysisDeps) {}
  private getDeps(): AnalysisDeps { return this.deps ?? { crm: crmClientFromEnv(), generate: (p) => AI.generate(p) }; }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm, generate } = this.getDeps();
    const recordType = input.recordType as RecordType;

    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, { query: input.query, limit: 10 });
    const resolution = resolveRecord(search.globalSearch, recordType, input.query);
    if (resolution.kind === "none") return { status: "not_found" as const, message: `No ${recordType} matching "${input.query}" was found.` };
    if (resolution.kind === "ambiguous") return {
      status: "ambiguous" as const,
      message: `Multiple ${recordType}s match "${input.query}" — ask the user to pick one, then call again with the chosen id as query.`,
      candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
    };

    const { document, rootField } = DETAIL_QUERIES[recordType];
    const detail = await crm.query<Record<string, Record<string, unknown> | null>>(document, { id: resolution.result.id });
    const record = detail[rootField];
    if (!record) return { status: "not_found" as const, message: `The ${recordType} could not be loaded.` };

    const docArg = DOCUMENT_ARG[recordType];
    if (docArg) {
      try {
        const docs = await crm.query<{ documents: Array<Record<string, unknown>> | null }>(DOCUMENTS_QUERY, { [docArg]: resolution.result.id });
        record.documents = (docs.documents ?? []).slice(0, 10);
      } catch { /* metadata is decoration */ }
    }

    const { findings, depth } = assessDealHealth(recordType, record);
    const name = String(record.name ?? input.query);
    let summary: string;
    try { summary = await generate(buildDealHealthPrompt(recordType, name, findings, depth, input.focus)); }
    catch { summary = `## ${name} — health check\n` + findings.map((f) => `- [${f.severity}] ${f.area}: ${f.detail}`).join("\n"); }

    return { status: "ok" as const, summary, depth, link: `${crm.baseUrl}${resolution.result.href}` };
  }
}
