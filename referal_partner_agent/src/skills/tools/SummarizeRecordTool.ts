import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { staffRefusal, type StaffCheck } from "../../lib/staff-mode";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { GLOBAL_SEARCH, DETAIL_QUERIES, DOCUMENTS_QUERY, DOCUMENT_ARG } from "../../lib/queries";
import { resolveRecord, type RecordType, type SearchResult } from "../../lib/resolve";
import { buildRecordPrompt, fallbackRecordMarkdown } from "../../lib/format";

export interface SummarizeDeps {
  crm: CrmClient;
  generate: (prompt: string) => Promise<string>;
  isStaff?: StaffCheck;
}

const inputSchema = z.object({
  recordType: z
    .enum(["client", "investor", "mandate", "transaction", "engagement", "partner"])
    .describe("Which kind of CRM record to summarize"),
  query: z.string().min(1).describe("The record's name as the user said it, or an exact record id from a previous candidates list"),
  focus: z.string().optional().describe("Optional angle to weight the briefing toward, e.g. 'risks' or 'next steps'"),
});

export class SummarizeRecordTool implements LuaTool {
  name = "summarize_record";
  description =
    "Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.";
  inputSchema = inputSchema;

  constructor(private deps?: SummarizeDeps) {}

  private getDeps(): SummarizeDeps {
    return this.deps ?? { crm: crmClientFromEnv(), generate: (p: string) => AI.generate(p) };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const refusal = await staffRefusal(this.deps?.isStaff);
    if (refusal) return refusal;
    const { crm, generate } = this.getDeps();
    const recordType = input.recordType as RecordType;

    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, {
      query: input.query,
      limit: 10,
    });
    const resolution = resolveRecord(search.globalSearch, recordType, input.query);

    if (resolution.kind === "none") {
      return {
        status: "not_found" as const,
        message: `No ${recordType} matching "${input.query}" was found in the CRM.`,
      };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: `Multiple ${recordType}s match "${input.query}" — ask the user to pick one, then call this tool again with the chosen id as query.`,
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const { document, rootField } = DETAIL_QUERIES[recordType];
    const detail = await crm.query<Record<string, Record<string, unknown> | null>>(document, {
      id: resolution.result.id,
    });
    const record = detail[rootField];
    if (!record) {
      return { status: "not_found" as const, message: `The ${recordType} could not be loaded from the CRM.` };
    }

    // Attach document METADATA (never file contents) where the CRM supports it.
    // Metadata is decoration — a failure here must never sink a summary whose
    // detail record already loaded.
    const docArg = DOCUMENT_ARG[recordType];
    if (docArg) {
      try {
        const docs = await crm.query<{ documents: Array<Record<string, unknown>> | null }>(DOCUMENTS_QUERY, {
          [docArg]: resolution.result.id,
        });
        record.documents = (docs.documents ?? []).slice(0, 10);
      } catch {
        // Summarize without documents rather than failing the request.
      }
    }

    let summary: string;
    try {
      summary = await generate(buildRecordPrompt(recordType, record, input.focus));
    } catch {
      summary = fallbackRecordMarkdown(recordType, record);
    }

    return { status: "ok" as const, summary, link: `${crm.baseUrl}${resolution.result.href}` };
  }
}
