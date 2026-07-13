import { LuaSkill } from "lua-cli";
import { SummarizeRecordTool } from "./tools/SummarizeRecordTool";
import { PipelineDigestTool } from "./tools/PipelineDigestTool";

export const summarySkill = new LuaSkill({
  name: "crm-summary",
  description: "Summaries of NobleStride CRM records and pipeline movement.",
  context: `This skill answers questions about NobleStride's CRM records and pipeline. All data is internal.
- Use summarize_record when the user asks about ONE specific record ("summarize Acme", "brief me on the Busoga transaction", "status of investor X"). Pass recordType and the name exactly as the user said it. Pass focus when they ask for a specific angle (risks, next steps).
- If summarize_record returns status "ambiguous", list the candidates (title + subtitle) and ask the user to pick; then call it again with the chosen candidate's id as query.
- If it returns "not_found", say so plainly and ask for a spelling or more context — never guess.
- Use pipeline_digest when the user asks what changed, moved, is new, or is stalled ("what happened this week?"). Default days=7.
- When the user asks for "this week's digest" or "the weekly digest", call pipeline_digest with useStored=true.
- Relay the tool's summary/digest text as the core of your answer; append the link when present. Never expose raw record ids.`,
  tools: [new SummarizeRecordTool(), new PipelineDigestTool()],
});
