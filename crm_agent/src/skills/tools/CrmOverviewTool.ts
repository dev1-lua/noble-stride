import { type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { CRM_OVERVIEW } from "../../lib/queries";
import { shapeOverview, renderOverview, type OverviewRaw } from "../../lib/overview";

export interface CrmOverviewDeps {
  crm: CrmClient;
}

/**
 * A3 / F5.3 (image20). The client asked this agent "what is the main function of
 * this CRM" and "how many opportunities are in the pipeline" and it had no tool
 * for either: summarize_record answers about one named record, analyze_pipeline
 * returns a narrative. This answers the org-level question, and always ships the
 * definition of "opportunity" with the total so the number cannot be misread as
 * including advisory work.
 *
 * No input: it is a whole-book question by construction.
 */
export class CrmOverviewTool implements LuaTool {
  name = "crm_overview";
  description =
    "Answer org-level questions about the CRM itself: what it is for, how many opportunities are in the pipeline, how many investors are on file, capital raised year to date, and which stages hold the most records. Use for 'what is this CRM', 'what is the main function of this CRM', 'how many opportunities/deals are in the pipeline', 'how big is the investor list'. Not for one named record (use summarize_record) and not for narrative pipeline analysis (use analyze_pipeline).";

  inputSchema = z.object({});

  constructor(private deps?: CrmOverviewDeps) {}

  private getDeps(): CrmOverviewDeps {
    return this.deps ?? { crm: crmClientFromEnv() };
  }

  async execute(_input: z.infer<typeof this.inputSchema>) {
    const { crm } = this.getDeps();
    const raw = await crm.query<OverviewRaw>(CRM_OVERVIEW);
    const counts = shapeOverview(raw);
    const link = `${crm.baseUrl}/dashboard`;
    return { status: "ok" as const, summary: renderOverview(counts, link), counts, link };
  }
}
