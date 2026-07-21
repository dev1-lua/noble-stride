import { LuaSkill } from "lua-cli";
import { DealHealthTool } from "./tools/DealHealthTool";
import { AnalyzePipelineTool } from "./tools/AnalyzePipelineTool";
import { ListDealsByStageTool } from "./tools/ListDealsByStageTool";
import { MatchInvestorsTool } from "./tools/MatchInvestorsTool";
import { ListGreylistedInvestorsTool } from "./tools/ListGreylistedInvestorsTool";

export const analysisSkill = new LuaSkill({
  name: "crm-analysis",
  description: "Analytical questions about Noblestride CRM data: deal-health reviews, pipeline analysis, and investor matching. Internal use only.",
  context: `This skill answers ANALYTICAL and SCENARIO questions (not simple lookups — those stay with crm-summary).
- Use deal_health when the user asks to "check", "review", "audit", or "what's the status/risk on" ONE deal/record ("check everything on the Busoga transaction"). Pass recordType and the name as said; pass focus for a specific angle.
- Use analyze_pipeline when the user asks about the pipeline as a whole in AGGREGATE terms ("what's stalling?", "where's the value concentrated?", "how healthy is the transaction pipeline?", "totals by stage").
- Use list_deals_by_stage when the user wants the deals NAMED, grouped by stage ("what deals are in which stage", "list/name the deals by stage", "give me the deals in Term Sheet"). By default (no stage filter) it returns a SHORT overview per stage: the stage's true total count, the first few example names, and a "remaining" count of names not shown. Render it compactly: for each stage give the label, the count, the few names, and "(+{remaining} more)" when remaining > 0; add one short line reading the overall shape; then invite the reader to open a specific stage for the full list. Do NOT print every deal name across every stage. When the user names ONE stage, pass it as the stage filter — the tool then returns that stage's FULL list (remaining 0) and you name them all. Pass pipeline (mandates/transactions/both) and the optional stage filter.
- Use match_investors when the user asks which investors fit a transaction.
- Use list_greylisted_investors when the user asks which investors are greylisted or excluded ("who's greylisted?", "show the excluded funds"). Pass includeExcluded:true to also include Excluded. Relay names with their deep links; if it returns empty, say none are currently classified that way.
- If a tool returns "ambiguous", list the candidates and ask which one; then call again with the chosen id.
- For deal_health, analyze_pipeline, and match_investors, relay the tool's summary as the complete answer. It already contains the insight layer AND, whenever deeper data exists (the tool's "depth" is non-empty), a tailored go-deeper invitation baked in — do NOT append a second offer, a fixed template, or a generic "anything else?" closer on top of it. If "depth" is empty, the summary already omits any such offer — don't add one.
- Never expose raw record ids; use names + the deep link when present. Facts only — never invent.`,
  tools: [
    new DealHealthTool(),
    new AnalyzePipelineTool(),
    new ListDealsByStageTool(),
    new MatchInvestorsTool(),
    new ListGreylistedInvestorsTool(),
  ],
});
