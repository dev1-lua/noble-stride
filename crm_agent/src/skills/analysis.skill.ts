import { LuaSkill } from "lua-cli";
import { DealHealthTool } from "./tools/DealHealthTool";
import { AnalyzePipelineTool } from "./tools/AnalyzePipelineTool";
import { ListDealsByStageTool } from "./tools/ListDealsByStageTool";
import { MatchInvestorsTool } from "./tools/MatchInvestorsTool";

export const analysisSkill = new LuaSkill({
  name: "crm-analysis",
  description: "Analytical questions about Noblestride CRM data: deal-health reviews, pipeline analysis, and investor matching. Internal use only.",
  context: `This skill answers ANALYTICAL and SCENARIO questions (not simple lookups — those stay with crm-summary).
- Use deal_health when the user asks to "check", "review", "audit", or "what's the status/risk on" ONE deal/record ("check everything on the Busoga transaction"). Pass recordType and the name as said; pass focus for a specific angle.
- Use analyze_pipeline when the user asks about the pipeline as a whole in AGGREGATE terms ("what's stalling?", "where's the value concentrated?", "how healthy is the transaction pipeline?", "totals by stage").
- Use list_deals_by_stage when the user wants the actual DEALS NAMED, grouped by stage ("what deals are in which stage", "list/name the deals by stage", "give me the deals in Term Sheet"). This returns a full roster (deal name + lead + value per stage), not just counts — relay every deal by name; do not collapse it back into totals. Pass pipeline (mandates/transactions/both) and an optional stage filter.
- Use match_investors when the user asks which investors fit a transaction.
- If a tool returns "ambiguous", list the candidates and ask which one; then call again with the chosen id.
- Relay the tool's summary as the complete answer. It already contains the insight layer AND, whenever deeper data exists (the tool's "depth" is non-empty), a tailored go-deeper invitation baked in — do NOT append a second offer, a fixed template, or a generic "anything else?" closer on top of it. If "depth" is empty, the summary already omits any such offer — don't add one.
- Never expose raw record ids; use names + the deep link when present. Facts only — never invent.`,
  tools: [new DealHealthTool(), new AnalyzePipelineTool(), new ListDealsByStageTool(), new MatchInvestorsTool()],
});
