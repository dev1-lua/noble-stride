import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { AI_MATCH_INVESTORS, DETAIL_QUERIES } from "../../lib/queries";
import { resolveByNameOrId } from "../../lib/record-lookup";

const inputSchema = z.object({
  deal: z
    .string()
    .min(1)
    .describe("The live transaction/deal to match investors against — name as the user said it, or an exact id"),
});

interface Match {
  id: string;
  name: string;
  score: number;
  reasons: string[];
  warnings: string[];
  contactName?: string | null;
  criteriaStale: boolean;
}

export class FindFitInvestorsTool implements LuaTool {
  name = "find_fit_investors";
  description =
    "Rank which investors fit a live deal (mandate criteria match: sector, geography, ticket size, instrument). Returns up to 8 matches with reasons and warnings, and notes which already have an engagement on this deal. Excluded and greylisted investors are never returned. Read-only — introducing an investor to the deal is a human decision.";
  inputSchema = inputSchema;

  constructor(private deps?: { crm: CrmClient }) {}

  async execute(input: z.infer<typeof inputSchema>) {
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

    const [matchResult, detail] = await Promise.all([
      crm.query<{ aiMatchInvestors: Match[] }>(AI_MATCH_INVESTORS, { transactionId: resolution.result.id }),
      crm.query<{
        transaction: { id: string; name: string; engagements: Array<{ investor: { id: string; engagementClassification?: string | null } }> } | null;
      }>(DETAIL_QUERIES.transaction.document, { id: resolution.result.id }),
    ]);

    // The CRM already restricts matches to Active+Approved investors; the
    // engaged-investor classifications below make the guarantee local and testable.
    const blockedIds = new Set(
      (detail.transaction?.engagements ?? [])
        .filter((e) => e.investor.engagementClassification === "Excluded" || e.investor.engagementClassification === "Greylisted")
        .map((e) => e.investor.id),
    );
    const engagedIds = new Set((detail.transaction?.engagements ?? []).map((e) => e.investor.id));

    const matches = matchResult.aiMatchInvestors
      .filter((m) => !blockedIds.has(m.id))
      .map((m) => ({
        name: m.name,
        id: m.id,
        score: m.score,
        reasons: m.reasons,
        warnings: m.warnings,
        contactName: m.contactName ?? null,
        criteriaStale: m.criteriaStale,
        alreadyEngagedOnThisDeal: engagedIds.has(m.id),
      }));

    return {
      status: "ok" as const,
      deal: resolution.result.title,
      matches,
      link: `${crm.baseUrl}${resolution.result.href}`,
      note: matches.length === 0 ? "No active, approved investors currently fit this deal's criteria." : undefined,
    };
  }
}
