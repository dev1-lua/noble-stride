import { LuaSkill } from "lua-cli";
import { SummarizeRecordTool } from "./tools/SummarizeRecordTool";
import { PipelineDigestTool } from "./tools/PipelineDigestTool";

export const summarySkill = new LuaSkill({
  name: "crm-summary",
  description: "Summaries of Noblestride CRM records and pipeline movement.",
  context: `This skill answers questions about Noblestride's CRM records and pipeline. All data is internal.
- Use summarize_record when the user asks about ONE specific record ("summarize Acme", "brief me on the Busoga transaction", "status of investor X", "check everything on Sizwe"). Pass the name exactly as the user said it. Pass focus when they ask for a specific angle (risks, next steps).
- recordType is OPTIONAL: only set it when the user is explicit about the kind (e.g. "the investor Acme"). When they just name something and you're not sure whether it's a client, mandate, or transaction — especially for "check everything on X" — OMIT recordType and the tool resolves the record whatever its type. Do NOT report "not found" just because you guessed the wrong type; retry once with recordType omitted before giving up.
- If summarize_record returns status "ambiguous", list the candidates (title + subtitle, and type when shown) and ask the user to pick; then call it again with the chosen candidate's id as query.
- If it returns "not_found" (after trying with recordType omitted), say so plainly and ask for a spelling or more context — search is now typo-tolerant, so a genuine not_found usually means the record truly isn't there.
- Use pipeline_digest when the user asks what changed, moved, is new, or is stalled ("what happened this week?"). Default days=7.
- When the user asks for "this week's digest" or "the weekly digest", call pipeline_digest with useStored=true.
- Relay the tool's summary/digest text as the core of your answer; append the link when present. Never expose raw record ids.
- Match your shape to the question: a simple "what stage is X?" gets one direct line with NO "go deeper" offer; a briefing gets the structured summary. Do not append generic "anything else?" closers.`,
  tools: [new SummarizeRecordTool(), new PipelineDigestTool()],
});
