import { LuaSkill } from "lua-cli";
import { DealHealthTool } from "./tools/DealHealthTool";
import { AnalyzePipelineTool } from "./tools/AnalyzePipelineTool";
import { MatchInvestorsTool } from "./tools/MatchInvestorsTool";

export const analysisSkill = new LuaSkill({
  name: "crm-analysis",
  description: "Analytical questions about Noblestride CRM data: deal-health reviews, pipeline analysis, and investor matching. Internal use only.",
  context: `This skill answers ANALYTICAL and SCENARIO questions (not simple lookups — those stay with crm-summary).
- Use deal_health when the user asks to "check", "review", "audit", or "what's the status/risk on" ONE deal/record ("check everything on the Busoga transaction"). Pass recordType and the name as said; pass focus for a specific angle.
- Use analyze_pipeline when the user asks about the pipeline as a whole ("what's stalling?", "where's the value concentrated?", "how healthy is the transaction pipeline?").
- Use match_investors when the user asks which investors fit a transaction.
- If a tool returns "ambiguous", list the candidates and ask which one; then call again with the chosen id.
- Relay the tool's summary as the core answer. It already contains the insight layer.
- DEPTH: each tool returns a "depth" list of dimensions with more data. If it is NON-EMPTY, end with ONE short, natural, freshly-worded invitation to go deeper into 1–3 of those dimensions, naming this specific record — never a fixed template, never a generic sign-off. If "depth" is EMPTY, do NOT add any such offer.
- Never expose raw record ids; use names + the deep link when present. Facts only — never invent.`,
  tools: [new DealHealthTool(), new AnalyzePipelineTool(), new MatchInvestorsTool()],
});
