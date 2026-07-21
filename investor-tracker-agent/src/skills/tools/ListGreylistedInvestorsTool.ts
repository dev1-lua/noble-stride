import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { LIST_INVESTORS } from "../../lib/queries";
import { BLOCKED_CLASSIFICATIONS } from "../../lib/guards";

// Bounded page for the client-side classification filter. The greylisted/excluded
// subset is small; this cap is far above any realistic count.
const PAGE_SIZE = 1000;

interface InvestorRow {
  id: string;
  name: string;
  engagementClassification: string | null;
  investorType?: string | null;
}

const inputSchema = z.object({
  includeExcluded: z
    .boolean()
    .default(false)
    .describe("Also include investors classified Excluded, not just Greylisted."),
});

export class ListGreylistedInvestorsTool implements LuaTool {
  name = "list_greylisted_investors";
  description =
    "List investors currently classified Greylisted (optionally also Excluded). Internal read-only reference: returns each investor's name, classification, type, and CRM deep link, never raw record ids. Use when staff ask which investors are greylisted or excluded (e.g. 'who's greylisted?', 'which funds are excluded?').";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
    const crm = this.deps?.crm ?? crmClientFromEnv();
    const data = await crm.query<{ investors: InvestorRow[] }>(LIST_INVESTORS, { page: 1, pageSize: PAGE_SIZE });
    const rows = data.investors ?? [];
    // A full page means there may be more investors past the fetched window; a
    // classified one could sit beyond it, so flag the list as possibly incomplete.
    const truncated = rows.length >= PAGE_SIZE;
    // Reuse the shared classification set so this stays in lockstep with the write guard.
    const wanted = new Set<string>(input.includeExcluded ? [...BLOCKED_CLASSIFICATIONS] : ["Greylisted"]);
    const investors = rows
      .filter((i) => i.engagementClassification && wanted.has(i.engagementClassification))
      .map((i) => ({
        name: i.name,
        classification: i.engagementClassification as string,
        type: i.investorType ?? null,
        link: `${crm.baseUrl}/investors/${i.id}`,
      }));

    if (investors.length === 0) {
      return { status: "empty" as const, includeExcluded: input.includeExcluded, truncated };
    }
    return { status: "ok" as const, total: investors.length, investors, truncated };
  }
}
