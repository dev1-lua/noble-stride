import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv } from "../../lib/crm-client";
import { GLOBAL_SEARCH, MATCH_INVESTORS } from "../../lib/queries";
import { resolveRecord, type SearchResult } from "../../lib/resolve";
import type { DepthDimension } from "../../lib/analysis";
import type { AnalysisDeps } from "./DealHealthTool";

interface Match { investorId: string; name: string; contactName?: string | null; matchReasons: string[]; hasExistingEngagement: boolean }

const inputSchema = z.object({
  transactionQuery: z.string().min(1).describe("The transaction's name as the user said it, or an exact transaction id"),
});

export class MatchInvestorsTool implements LuaTool {
  name = "match_investors";
  description = "Suggest investors whose stored criteria fit a transaction (sector/geography/ticket/instrument). Read-only; ranks existing CRM investors, never contacts anyone.";
  inputSchema = inputSchema;

  constructor(private deps?: AnalysisDeps) {}
  private getDeps(): AnalysisDeps { return this.deps ?? { crm: crmClientFromEnv(), generate: (p) => AI.generate(p) }; }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm } = this.getDeps();
    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, { query: input.transactionQuery, limit: 10 });
    const resolution = resolveRecord(search.globalSearch, "transaction", input.transactionQuery);
    if (resolution.kind === "none") return { status: "not_found" as const, message: `No transaction matching "${input.transactionQuery}" was found.` };
    if (resolution.kind === "ambiguous") return {
      status: "ambiguous" as const,
      message: `Multiple transactions match "${input.transactionQuery}" — ask the user to pick one, then call again with the chosen id.`,
      candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
    };

    const data = await crm.query<{ matchInvestorsForTransaction: Match[] }>(MATCH_INVESTORS, { transactionId: resolution.result.id });
    const matches = data.matchInvestorsForTransaction ?? [];
    if (matches.length === 0) return { status: "empty" as const, message: `No investors currently match this transaction's criteria.` };

    const lines = matches.slice(0, 8).map((m) =>
      `- **${m.name}**${m.contactName ? ` (${m.contactName})` : ""} — ${m.matchReasons.join(", ")}${m.hasExistingEngagement ? " · already engaged" : ""}`);
    const remaining = matches.length - 8;
    const depth: DepthDimension[] = remaining > 0 ? [{ dimension: "more_matches", label: `the remaining ${remaining} matches` }] : [];
    // This tool builds its summary deterministically (no generate() pass), so — unlike
    // DealHealthTool/AnalyzePipelineTool, whose prompts bake in a tailored go-deeper line —
    // it must append its own single invitation here when more matches exist, so the
    // summary is self-complete and the skill layer never needs to add a second one.
    const summary = `Investors matching this transaction:\n${lines.join("\n")}` +
      (remaining > 0 ? `\n\nWant to see the remaining ${remaining} match${remaining === 1 ? "" : "es"}?` : "");
    return { status: "ok" as const, summary, depth, link: `${crm.baseUrl}${resolution.result.href}` };
  }
}
