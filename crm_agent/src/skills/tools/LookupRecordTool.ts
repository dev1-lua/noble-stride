import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { GLOBAL_SEARCH } from "../../lib/queries";
import { resolveRecord, type RecordType, type SearchResult } from "../../lib/resolve";

export interface LookupDeps {
  crm: CrmClient;
}

const inputSchema = z.object({
  recordType: z
    .enum(["client", "investor", "mandate", "transaction", "engagement", "partner"])
    .describe("Which kind of CRM record to find"),
  query: z.string().min(1).describe("The record's name as the user said it, or an exact record id from a previous candidates list"),
});

export class LookupRecordTool implements LuaTool {
  name = "lookup_record";
  description =
    "Find a CRM record's id before proposing a change. Always call this first when the user names a record by name. Returns a unique match, ambiguous candidates to ask the user to pick from, or none. Never guess an id and never show raw ids to the user.";
  inputSchema = inputSchema;

  constructor(private deps?: LookupDeps) {}

  private getDeps(): LookupDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm } = this.getDeps();
    const recordType = input.recordType as RecordType;

    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, {
      query: input.query,
      limit: 10,
    });
    const resolution = resolveRecord(search.globalSearch, recordType, input.query);

    if (resolution.kind === "none") {
      return { status: "none" as const };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }
    return { status: "match" as const, id: resolution.result.id, title: resolution.result.title };
  }
}
